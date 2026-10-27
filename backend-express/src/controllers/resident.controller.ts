import type { Response } from "express";
import { Prisma, type Gender } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import argon2 from "argon2";
import type { AuthRequest } from "../middleware/auth.middleware.js";

import {
  getActorOrRespond,
  handlePrismaError,
  isGlobalSuperadmin,
} from "../utils/actor.js";
import { notifyActor } from "../services/notification.service.js";
import { auditActor } from "../services/audit.service.js";
import * as XLSX from "xlsx";



import { isValidEmail, normalizeEmail, normalizeHeader, parseGender, readString } from "../utils/excel.js";
import type { ImportResidentRow, ResidentRowError } from "../types/resident.type.js";
import {
  optionalString,
  residentSiteFilter,
  residentSiteScope,
} from "../helpers/resident.helper.js";





export async function listResidents(req: AuthRequest, res: Response) {
  try {
    const actor = await getActorOrRespond(req, res);
    if (!actor) return;

    const page = Math.max(
      1,
      Number.parseInt(String(req.query.page ?? "1"), 10) || 1,
    );
    const pageSize = Math.min(
      100,
      Math.max(
        1,
        Number.parseInt(String(req.query.pageSize ?? "20"), 10) || 20,
      ),
    );

    const search =
      typeof req.query.search === "string"
        ? req.query.search.trim()
        : "";

    const siteId =
      typeof req.query.siteId === "string" ? req.query.siteId : undefined;

    const genderSearch = search ? parseGender(search) : null;

    const where: Prisma.ResidentWhereInput = {
      ...residentSiteFilter(actor),
      ...(siteId ? { siteId } : {}),
      // Deactivated residents are hidden, matching the management UI.
      user: { isActive: true },
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: "insensitive" } },
              { phone: { contains: search, mode: "insensitive" } },
              { nationality: { contains: search, mode: "insensitive" } },
              { mealType: { contains: search, mode: "insensitive" } },
              { company: { contains: search, mode: "insensitive" } },
              { department: { contains: search, mode: "insensitive" } },
              { title: { contains: search, mode: "insensitive" } },
              { user: { email: { contains: search, mode: "insensitive" } } },
              ...(genderSearch ? [{ gender: genderSearch }] : []),
            ],
          }
        : {}),
    };

    const [residents, total] = await prisma.$transaction([
      prisma.resident.findMany({
        where,
        include: {
          user: {
            select: { id: true, email: true, isActive: true },
          },
          site: {
            select: { id: true, name: true },
          },
        },
        orderBy: { fullName: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.resident.count({ where }),
    ]);

    return res.json({
      residents,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    return handlePrismaError(error, res);
  }
}

// GET /api/residents/:id
export async function getResident(req: AuthRequest, res: Response) {
  try {
    const actor = await getActorOrRespond(req, res);
    if (!actor) return;

    const resident = await prisma.resident.findFirst({
      where: {
        id: req.params.id as string,
        ...residentSiteFilter(actor),
      },
      include: {
        user: {
          select: { id: true, email: true, isActive: true },
        },
        site: {
          select: { id: true, name: true },
        },
      },
    });

    if (!resident) {
      return res.status(404).json({ message: "Resident not found" });
    }

    return res.json({ resident });
  } catch (error) {
    return handlePrismaError(error, res, {
      notFound: "Resident not found",
    });
  }
}

// POST /api/residents
export async function createResident(req: AuthRequest, res: Response) {
  try {
    const actor = await getActorOrRespond(req, res);
    if (!actor) return;

    const {
      email,
      password,
      siteId,
      fullName,
      gender,
      phone,
      nationality,
      mealType,
      company,
      department,
      title,
    } = req.body;

    if (
      typeof email !== "string" ||
      !email.trim() ||
      typeof password !== "string" ||
      password.length < 8 ||
      typeof siteId !== "string" ||
      !siteId ||
      typeof fullName !== "string" ||
      !fullName.trim()
    ) {
      return res.status(400).json({
        message:
          "Valid email, password (at least 8 characters), siteId, and fullName are required.",
      });
    }

    if (
      nationality != null && typeof nationality !== "string" ||
      company != null && typeof company !== "string" ||
      department != null && typeof department !== "string" ||
      title != null && typeof title !== "string"
    ) {
      return res.status(400).json({
        message: "Nationality, company, department, and title must be strings.",
      });
    }

    

    // A non-global administrator can only create residents in their own site.
    if (!isGlobalSuperadmin(actor) && actor.siteId !== siteId) {
      return res.status(403).json({
        message: "You cannot create residents for another site.",
      });
    }

    const site = await prisma.site.findUnique({
      where: { id: siteId },
      select: { id: true, name: true },
    });

    if (!site) {
      return res.status(400).json({ message: "Site not found." });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (existingUser) {
      return res.status(409).json({
        message: "An account with this email already exists.",
      });
    }

    const passwordHash = await argon2.hash(password, {
  type: argon2.argon2id,
});

    // Create both records atomically.
    const resident = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: normalizedEmail,
          password: passwordHash,
          isActive: true,
        },
        select: { id: true, email: true, },
      });

      return tx.resident.create({
        data: {
          userId: user.id,
          siteId,
          fullName: fullName.trim(),
          gender,
          phone,
          
          nationality: optionalString(nationality) ?? null,
          mealType: mealType ?? "REGULAR",
          company: optionalString(company) ?? null,
          department: optionalString(department) ?? null,
          title: optionalString(title) ?? null,
        },
        include: {
          user: {
            select: { id: true, email: true,  },
          },
          site: {
            select: { id: true, name: true },
          },
        },
      });
    });

    await notifyActor(req, {
      title: "Resident Created",
      message: `Resident ${resident.fullName} was created successfully.`,
      type: "SUCCESS",
    });

    await auditActor(req, actor, {
      action: "create",
      resource: "resident",
      resourceId: resident.id,
      description: `Resident ${resident.fullName} created for site ${site.name}`,
      after: {
        ...resident,
        /*
        user: {
          id: resident.user.id,
          email: resident.user.email,
        },
        */
      },
    });

    // Never return or log the plaintext password or password hash.
    return res.status(201).json({
      message: "Resident created successfully.",
      resident,
    });
  } catch (error) {
    return handlePrismaError(error, res, {
      duplicate: "This email or resident account already exists.",
      conflict: "Cannot create the resident account.",
    });
  }
}

// PATCH /api/residents/:id
export async function updateResident(req: AuthRequest, res: Response) {
  try {
    const actor = await getActorOrRespond(req, res);
    if (!actor) return;

    const id = req.params.id as string;

    const before = await prisma.resident.findFirst({
      where: {
        id,
        ...residentSiteFilter(actor),
      },
      include: {
        user: { select: { id: true, email: true, isActive: true } },
      },
    });

    if (!before) {
      return res.status(404).json({ message: "Resident not found" });
    }

    const {
      fullName,
      nationality,
      mealType,
      company,
      department,
      title,
      siteId,
    } = req.body;

    if (
      siteId !== undefined &&
      (typeof siteId !== "string" || !siteId.trim())
    ) {
      return res.status(400).json({ message: "Invalid siteId." });
    }

    const targetSiteId: string = siteId ?? before.siteId;

    if (
      !isGlobalSuperadmin(actor) &&
      targetSiteId !== actor.siteId
    ) {
      return res.status(403).json({
        message: "You cannot move a resident to another site.",
      });
    }

    if (
      fullName !== undefined &&
      (typeof fullName !== "string" || !fullName.trim())
    ) {
      return res.status(400).json({ message: "fullName cannot be empty." });
    }

    const stringFields = {
      nationality,
      company,
      department,
      title,
    };

    for (const [field, value] of Object.entries(stringFields)) {
      if (value !== undefined && value !== null && typeof value !== "string") {
        return res.status(400).json({
          message: `${field} must be a string or null.`,
        });
      }
    }

    if (siteId !== undefined) {
      const site = await prisma.site.findUnique({
        where: { id: targetSiteId },
        select: { id: true },
      });

      if (!site) {
        return res.status(400).json({ message: "Site not found." });
      }
    }

    const after = await prisma.resident.update({
      where: { id },
      data: {
        ...(fullName !== undefined ? { fullName: fullName.trim() } : {}),
        ...(siteId !== undefined ? { siteId: targetSiteId } : {}),
        ...(nationality !== undefined
          ? { nationality: optionalString(nationality) ?? null }
          : {}),
        ...(mealType !== undefined ? { mealType } : {}),
        ...(company !== undefined
          ? { company: optionalString(company) ?? null }
          : {}),
        ...(department !== undefined
          ? { department: optionalString(department) ?? null }
          : {}),
        ...(title !== undefined
          ? { title: optionalString(title) ?? null }
          : {}),
      },
      include: {
        user: { select: { id: true, email: true, isActive: true } },
        site: { select: { id: true, name: true } },
      },
    });

    await notifyActor(req, {
      title: "Resident Updated",
      message: `Resident ${after.fullName} was updated successfully.`,
      type: "INFO",
    });

    await auditActor(req, actor, {
      action: "update",
      resource: "resident",
      resourceId: after.id,
      description: `Resident ${after.fullName} updated`,
      before,
      after,
    });

    return res.json({
      message: "Resident updated successfully.",
      resident: after,
    });
  } catch (error) {
    return handlePrismaError(error, res, {
      notFound: "Resident not found",
    });
  }
}

// DELETE /api/residents/:id
// Deactivate the login account instead of deleting historical resident data.
export async function deactivateResident(
  req: AuthRequest,
  res: Response,
) {
  try {
    const actor = await getActorOrRespond(req, res);
    if (!actor) return;

    const id = req.params.id as string;

    const resident = await prisma.resident.findFirst({
      where: {
        id,
        ...residentSiteFilter(actor),
      },
      include: {
        user: {
          select: { id: true, email: true, isActive: true },
        },
      },
    });

    if (!resident) {
      return res.status(404).json({ message: "Resident not found" });
    }

    if (!resident.user.isActive) {
      return res.status(409).json({
        message: "This resident account is already inactive.",
      });
    }

    await prisma.user.update({
      where: { id: resident.userId },
      data: { isActive: false },
    });

    await notifyActor(req, {
      title: "Resident Deactivated",
      message: `Resident ${resident.fullName}'s account was deactivated.`,
      type: "WARNING",
    });

    await auditActor(req, actor, {
      action: "deactivate",
      resource: "resident",
      resourceId: resident.id,
      description: `Resident ${resident.fullName}'s account deactivated`,
      before: resident,
      after: {
        residentId: resident.id,
        userId: resident.userId,
        isActive: false,
      },
    });

    return res.json({
      message: "Resident account deactivated successfully.",
    });
  } catch (error) {
    return handlePrismaError(error, res, {
      notFound: "Resident not found",
    });
  }
}

export async function importResidentsFromExcel(
  req: AuthRequest,
  res: Response,
) {
  try {
    const actor = await getActorOrRespond(req, res);
    if (!actor) return;

    if (!req.file) {
      return res.status(400).json({
        message: "Please upload an Excel file.",
      });
    }

    if (!req.file.originalname.toLowerCase().endsWith(".xlsx")) {
      return res.status(400).json({
        message: "Only .xlsx files are supported.",
      });
    }

    let rawRows: Record<string, unknown>[];

    try {
      const workbook = XLSX.read(req.file.buffer, {
        type: "buffer",
      });

      const firstSheet = workbook.SheetNames[0];

      if (!firstSheet) {
        return res.status(400).json({
          message: "The workbook contains no worksheet.",
        });
      }

      rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
        workbook.Sheets[firstSheet],
        { defval: "" },
      );
    } catch {
      return res.status(400).json({
        message: "Unable to read the Excel file.",
      });
    }

    if (rawRows.length === 0) {
      return res.status(400).json({
        message: "The worksheet contains no resident rows.",
      });
    }

    if (rawRows.length > 1000) {
      return res.status(400).json({
        message: "A maximum of 1,000 residents can be imported per file.",
      });
    }

    const rows = rawRows.map((raw) => {
      const normalized: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(raw)) {
        normalized[normalizeHeader(key)] = value;
      }

      return normalized;
    });

    const requiredHeaders = [
      "fullname",
      "email",
      "password",
      "phone",
      "gender",
"mealtype",
      "sitename",
      "nationality",
      "company",
      "department",
      "title",
    ];

    const headers = new Set(Object.keys(rows[0] ?? {}));
    const missingHeaders = requiredHeaders.filter(
      (header) => !headers.has(header),
    );

    if (missingHeaders.length > 0) {
      return res.status(400).json({
        message: "Required Excel columns are missing.",
        missingColumns: missingHeaders,
        requiredColumns: requiredHeaders,
      });
    }

    const errors: ResidentRowError[] = [];
    const parsedRows: Array<ImportResidentRow & { excelRow: number }> = [];
    const seenEmails = new Set<string>();
    



    for (let index = 0; index < rows.length; index++) {
      const raw = rows[index];
      const excelRow = index + 2;

      const resident: ImportResidentRow = {
        fullName: readString(raw.fullname),
        email: normalizeEmail(readString(raw.email)),
        password: readString(raw.password),
        phone: readString(raw.phone),
        gender: readString(raw.gender).toUpperCase(),
        mealType: readString(raw.mealtype).toUpperCase(),
        siteName: readString(raw.sitename),
        nationality: readString(raw.nationality),
        company: readString(raw.company),
        department: readString(raw.department),
        title: readString(raw.title),
      };
      const gender = parseGender(raw.gender);



      const rowErrors: string[] = [];
      
      if (resident.password.length < 8) {
  rowErrors.push("Password must be at least 8 characters.");
}

      if (!resident.fullName) rowErrors.push("fullName is required.");
      if (!resident.email || !isValidEmail(resident.email)) {
        rowErrors.push("A valid email is required.");
      }
      if (!resident.siteName) rowErrors.push("siteName is required.");

      if (resident.fullName.length > 150) {
        rowErrors.push("fullName cannot exceed 150 characters.");
      }
      if (resident.email.length > 254) {
        rowErrors.push("email cannot exceed 254 characters.");
      }
      if (resident.phone.length > 50) {
        rowErrors.push("phone cannot exceed 50 characters.");
      }

      if (resident.email) {
        if (seenEmails.has(resident.email)) {
          rowErrors.push("Duplicate email in this Excel file.");
        } else {
          seenEmails.add(resident.email);
        }
      }

      if (rowErrors.length > 0) {
        for (const message of rowErrors) {
          errors.push({
            row: excelRow,
            fullName: resident.fullName,
            message,
          });
        }
        continue;
      }

      parsedRows.push({ ...resident, excelRow });
    }

    // Resolve sites and enforce the importing employee's site scope.
    const sites = await prisma.site.findMany({
      where: residentSiteScope(actor),
      select: { id: true, name: true },
    });

    const sitesByName = new Map<string, typeof sites>();

    for (const site of sites) {
      const key = site.name.trim().toLowerCase();
      const matches = sitesByName.get(key) ?? [];
      matches.push(site);
      sitesByName.set(key, matches);
    }

    const resolvedRows: Array<{
      resident: ImportResidentRow & { excelRow: number };
      siteId: string;
    }> = [];

    for (const resident of parsedRows) {
      const matchingSites =
        sitesByName.get(resident.siteName.toLowerCase()) ?? [];

      if (matchingSites.length === 0) {
        errors.push({
          row: resident.excelRow,
          fullName: resident.fullName,
          message:
            "Site not found or you are not authorized to manage this site.",
        });
        continue;
      }

      if (matchingSites.length > 1) {
        errors.push({
          row: resident.excelRow,
          fullName: resident.fullName,
          message:
            "This site name is ambiguous. Please use a unique site name.",
        });
        continue;
      }

      resolvedRows.push({
        resident,
        siteId: matchingSites[0].id,
      });
    }

    // Check emails against existing user accounts.
    const emails = resolvedRows.map(({ resident }) => resident.email);

    const existingUsers = emails.length
      ? await prisma.user.findMany({
          where: { email: { in: emails } },
          select: { email: true },
        })
      : [];

    const existingEmails = new Set(
      existingUsers.map((user) => normalizeEmail(user.email)),
    );

    const eligibleRows = resolvedRows.filter(({ resident }) => {
      if (!existingEmails.has(resident.email)) return true;

      errors.push({
        row: resident.excelRow,
        fullName: resident.fullName,
        message: "This email is already registered.",
      });

      return false;
    });

    if (errors.length > 0) {
      return res.status(400).json({
        message: "Resident import validation failed. No accounts were created.",
        totalRows: rawRows.length,
        validRows: eligibleRows.length,
        errorCount: errors.length,
        errors,
      });
    }

    if (eligibleRows.length === 0) {
      return res.status(400).json({
        message: "There are no residents to import.",
      });
    }

    
  const preparedRows = await Promise.all(
  eligibleRows.map(async ({ resident, siteId }) => {
    const passwordHash = await argon2.hash(resident.password, {
      type: argon2.argon2id,
    });

    return {
      resident,
      siteId,
      passwordHash,
    };
  }),
);

    const createdResidents = await prisma.$transaction(
      async (tx) => {
        const created = [];

        for (const { resident, siteId, passwordHash } of preparedRows) {
          const createdResident = await tx.user.create({
            data: {
              email: resident.email,
              password: passwordHash,
              isActive: true,
              resident: {
                create: {
                  siteId,
                  fullName: resident.fullName,
                  phone: resident.phone ,
                  gender: resident.gender as Gender,
                  nationality: resident.nationality ,
                  company: resident.company ,
                  mealType: resident.mealType,
                  department: resident.department ,
                  title: resident.title ,
                },
              },
            },
            select: {
              id: true,
              email: true,
              resident: {
                select: {
                  id: true,
                  fullName: true,
                  siteId: true,
                  phone: true,
                },
              },
            },
          });

          created.push(createdResident);
        }

        return created;
      },
      { maxWait: 10000, timeout: 60000 },
    );

    await notifyActor(req, {
      title: "Resident Import Completed",
      message: `${createdResidents.length} resident accounts were imported successfully.`,
      type: "SUCCESS",
    });

    await auditActor(req, actor, {
      action: "import",
      resource: "resident",
      description: `Imported ${createdResidents.length} resident accounts from Excel`,
      after: {
        filename: req.file.originalname,
        importedCount: createdResidents.length,
        residentIds: createdResidents.map(
          (resident) => resident.id,
        ),
      },
    });

    return res.status(201).json({
      message: "Residents imported successfully.",
      importedResidents: createdResidents.length,
    });
  } catch (error) {
    return handlePrismaError(error, res, {
      duplicate: "An email address is already registered.",
      conflict: "Unable to import residents because of a database conflict.",
    });
  }
}

export async function exportResidentsToExcel(
  req: AuthRequest,
  res: Response,
) {
  try {
    const actor = await getActorOrRespond(req, res);
    if (!actor) return;

    const search =
      typeof req.query.search === "string"
        ? req.query.search.trim()
        : "";

    const requestedSiteId =
      typeof req.query.siteId === "string"
        ? req.query.siteId.trim()
        : "";

    // Non-global employees cannot export another site's residents.
    if (
      requestedSiteId &&
      !isGlobalSuperadmin(actor) &&
      requestedSiteId !== actor.siteId
    ) {
      return res.status(403).json({
        message: "You cannot export residents from another site.",
      });
    }

    const where: Prisma.ResidentWhereInput = {
      ...residentSiteFilter(actor),
      ...(requestedSiteId ? { siteId: requestedSiteId } : {}),
      ...(search
        ? {
            OR: [
              {
                fullName: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                phone: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                nationality: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                company: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                department: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                title: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                user: {
                  email: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
              },
            ],
          }
        : {}),
    };

    const residents = await prisma.resident.findMany({
      where,
      select: {
        id: true,
        fullName: true,
        phone: true,
        gender: true,
        nationality: true,
        mealType: true,
        company: true,
        department: true,
        title: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            email: true,
            isActive: true,
          },
        },
        site: {
          select: {
            name: true,
            code: true,
          },
        },
      },
      orderBy: [{ fullName: "asc" }],
    });

    if (residents.length === 0) {
      return res.status(400).json({
        message: search
          ? "No residents match the selected filters. Nothing to export."
          : "There are no residents to export.",
      });
    }

    const rows = residents.map((resident) => ({
      residentId: resident.id,
      fullName: resident.fullName,
      email: resident.user.email,
      phone: resident.phone,
      gender: resident.gender,
      nationality: resident.nationality ?? "",
      mealType: resident.mealType,
      company: resident.company ?? "",
      department: resident.department ?? "",
      title: resident.title ?? "",
      status: resident.status ?? "",
      siteName: resident.site?.name ?? "",
      siteCode: resident.site?.code ?? "",
      accountActive: resident.user.isActive ? "YES" : "NO",
      createdAt: resident.createdAt.toISOString(),
      updatedAt: resident.updatedAt.toISOString(),
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);

    worksheet["!cols"] = [
      { wch: 28 }, // residentId
      { wch: 25 }, // fullName
      { wch: 32 }, // email
      { wch: 18 }, // phone
      { wch: 12 }, // gender
      { wch: 18 }, // nationality
      { wch: 18 }, // mealType
      { wch: 25 }, // company
      { wch: 22 }, // department
      { wch: 20 }, // title
      { wch: 16 }, // status
      { wch: 20 }, // siteName
      { wch: 16 }, // siteCode
      { wch: 16 }, // accountActive
      { wch: 24 }, // createdAt
      { wch: 24 }, // updatedAt
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, "Residents");

    const buffer = XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    });

    const filename = `residents-${new Date()
      .toISOString()
      .slice(0, 10)}.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`,
    );
    res.setHeader("Cache-Control", "no-store");

    await notifyActor(req, {
      title: "Resident data export successfully",
      message: `${residents.length} residents exported successfully`,
      type: "SUCCESS",
    });

    await auditActor(req, actor, {
      action: "Export",
      resource: "resident",
      description: `exported ${residents.length} residents to an excel file`, 
    })

    return res.status(200).send(buffer);
  } catch (error) {
    return handlePrismaError(error, res);
  }
}