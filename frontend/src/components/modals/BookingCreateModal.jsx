import { useCallback, useEffect, useMemo, useState } from "react";
import apiRequest from "../../api/client";
import useAuth from "../../contexts/useAuth";
import { ModalField } from "./AddModal";

const GENDER_OPTIONS = [
  { value: "", label: "Select gender" },
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "OTHER", label: "Other" },
];



const GENDER_LABELS = {
  MALE: "Male",
  FEMALE: "Female",
  OTHER: "Other",
};

const MEAL_TYPE_LABELS = {
  REGULAR: "Regular",
  VEGETARIAN: "Vegetarian",
  HALAL: "Halal",
  OTHER: "Other",
};

const RESIDENT_DETAIL_FIELDS = [
  { name: "fullName", label: "Full Name" },
  { name: "email", label: "Email", getValue: (resident) => resident.user?.email },
  { name: "phone", label: "Phone" },
  {
    name: "gender",
    label: "Gender",
    getValue: (resident) => GENDER_LABELS[resident.gender] ?? resident.gender,
  },
  { name: "nationality", label: "Nationality" },
  {
    name: "mealType",
    label: "Meal Type",
    getValue: (resident) =>
      MEAL_TYPE_LABELS[resident.mealType] ?? resident.mealType,
  },
  { name: "company", label: "Company" },
  { name: "department", label: "Department" },
  { name: "title", label: "Title" },
  { name: "site", label: "Site", getValue: (resident) => resident.site?.name },
];

const EMPTY_VALUES = {
  residentId: "",
  bedId: "",
  startedAt: "",
  endedAt: "",
  notes: "",
};

const EMPTY_NEW_RESIDENT = {
  fullName: "",
  email: "",
  password: "",
  phone: "",
  gender: "",
  siteId: "",
  nationality: "",
  mealType: "REGULAR",
  company: "",
  department: "",
  title: "",
};

function getResidentDetails(resident) {
  return RESIDENT_DETAIL_FIELDS.map((field) => ({
    ...field,
    value: field.getValue ? field.getValue(resident) : resident[field.name],
  }));
}

export default function BookingCreateModal({ onClose, onCreated }) {
  const { user, hasPermission } = useAuth();
  const canManageResidents = hasPermission("resident.manage");

  const [residents, setResidents] = useState([]);
  const [beds, setBeds] = useState([]);
  const [sites, setSites] = useState([]);
  const [values, setValues] = useState(EMPTY_VALUES);
  const [residentMode, setResidentMode] = useState("existing");
  const [newResident, setNewResident] = useState(EMPTY_NEW_RESIDENT);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const loadOptions = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const requests = [
        apiRequest("/api/resident?pageSize=100"),
        apiRequest("/api/bed?status=VACANT&pageSize=100"),
        canManageResidents
          ? apiRequest("/api/site").catch(() => null)
          : Promise.resolve(null),
      ];

      const [residentResponse, bedResponse, siteResponse] =
        await Promise.all(requests);

      setResidents(
        Array.isArray(residentResponse?.residents)
          ? residentResponse.residents
          : [],
      );

      const vacantBeds = Array.isArray(bedResponse?.beds)
        ? bedResponse.beds
        : [];

      setBeds(
        vacantBeds.filter(
          (bed) => bed.isActive !== false && bed.room?.isBookable !== false,
        ),
      );

      const siteList = Array.isArray(siteResponse?.data)
        ? siteResponse.data
        : [];

      setSites(siteList);

      setNewResident((prev) => ({
        ...prev,
        siteId: prev.siteId || user?.employee?.siteId || siteList[0]?.id || "",
      }));
    } catch (err) {
      setError(err.message || "Failed to load residents and vacant beds.");
    } finally {
      setIsLoading(false);
    }
  }, [canManageResidents, user]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadOptions();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadOptions]);

  const residentOptions = useMemo(
    () =>
      residents.map((resident) => ({
        value: resident.id,
        label: resident.user?.email
          ? `${resident.fullName} · ${resident.user.email}`
          : resident.fullName,
      })),
    [residents],
  );

  const bedOptions = useMemo(
    () =>
      beds.map((bed) => ({
        value: bed.id,
        label: `${bed.room?.name ?? "Room"} — ${bed.name}`,
      })),
    [beds],
  );

  const siteOptions = useMemo(() => {
    const options = sites.map((site) => ({
      value: site.id,
      label: site.name,
    }));

    if (options.length > 0) return options;

    if (user?.employee?.siteId) {
      return [
        {
          value: user.employee.siteId,
          label: user.employee.siteName ?? "Current site",
        },
      ];
    }

    return [];
  }, [sites, user]);

  const selectedResident =
    residents.find((resident) => resident.id === values.residentId) ?? null;

  const handleChange = (name, value) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleNewResidentChange = (name, value) => {
    setNewResident((prev) => ({ ...prev, [name]: value }));
  };

  const handleResidentModeChange = (mode) => {
    setResidentMode(mode);
    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (residentMode === "existing" && !values.residentId) {
      setError("Select a resident.");
      return;
    }

    if (residentMode === "new") {
      if (
        !newResident.fullName.trim() ||
        !newResident.email.trim() ||
        !newResident.phone.trim() ||
        !newResident.gender ||
        !newResident.siteId ||
        !newResident.mealType ||
        newResident.password.length < 8
      ) {
        setError(
          "Fill in the required resident fields. The password must be at least 8 characters.",
        );
        return;
      }
    }

    if (!values.bedId) {
      setError("Select a vacant bed.");
      return;
    }

    const startedAt = new Date(`${values.startedAt}T00:00:00.000Z`);
    const endedAt = new Date(`${values.endedAt}T00:00:00.000Z`);

    if (
      Number.isNaN(startedAt.getTime()) ||
      Number.isNaN(endedAt.getTime()) ||
      startedAt >= endedAt
    ) {
      setError("The end date must be after the start date.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    let createdResident = null;

    try {
      let residentId = values.residentId;

      if (residentMode === "new") {
        const residentResponse = await apiRequest("/api/resident", {
          method: "POST",
          body: JSON.stringify({
            email: newResident.email.trim(),
            password: newResident.password,
            siteId: newResident.siteId,
            fullName: newResident.fullName.trim(),
            phone: newResident.phone.trim(),
            gender: newResident.gender,
            nationality: newResident.nationality.trim() || undefined,
            mealType: newResident.mealType,
            company: newResident.company.trim() || undefined,
            department: newResident.department.trim() || undefined,
            title: newResident.title.trim() || undefined,
          }),
        });

        createdResident = residentResponse?.resident ?? null;

        if (!createdResident?.id) {
          createdResident = null;
          throw new Error("The resident was created but no id was returned.");
        }

        residentId = createdResident.id;

        setNewResident((prev) => ({
          ...EMPTY_NEW_RESIDENT,
          siteId: prev.siteId,
        }));
      }

      const response = await apiRequest("/api/booking", {
        method: "POST",
        body: JSON.stringify({
          residentId,
          bedId: values.bedId,
          startedAt: startedAt.toISOString(),
          endedAt: endedAt.toISOString(),
          notes: values.notes.trim() || undefined,
        }),
      });

      onCreated(response?.data);
      onClose();
    } catch (err) {
      const message = err.message || "Failed to create booking.";

      /*
       * The resident is created before the booking, so a booking
       * failure must not leave the user without a way to reuse it.
       * Switch to the existing-resident flow with it selected.
       */
      if (createdResident) {
        setResidents((prev) => [createdResident, ...prev]);
        setResidentMode("existing");
        setValues((prev) => ({
          ...prev,
          residentId: createdResident.id,
        }));

        setError(
          `${message} The new resident was created and selected; choose a bed and try again.`,
        );
      } else {
        setError(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div
        className="modal modal--wide"
        role="dialog"
        aria-modal="true"
        aria-label="Create Booking"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal__header">
          <h2 className="modal__title">Create Booking</h2>

          <button
            type="button"
            className="modal__close"
            onClick={onClose}
            aria-label="Close"
          >
            <i className="bi bi-x-lg" aria-hidden="true" />
          </button>
        </div>

        <form className="modal__form" onSubmit={handleSubmit}>
          {isLoading && (
            <p className="muted">Loading residents and vacant beds...</p>
          )}

          <section className="modal__section">
            <h3 className="modal__section-title">1. Resident Data</h3>

            {canManageResidents && (
              <div className="modal__options">
                <button
                  type="button"
                  className={`modal__option${
                    residentMode === "existing" ? " is-active" : ""
                  }`}
                  onClick={() => handleResidentModeChange("existing")}
                >
                  Select existing resident
                </button>

                <button
                  type="button"
                  className={`modal__option${
                    residentMode === "new" ? " is-active" : ""
                  }`}
                  onClick={() => handleResidentModeChange("new")}
                >
                  Add new resident
                </button>
              </div>
            )}

            {residentMode === "existing" ? (
              <>
                <ModalField
                  field={{
                    name: "residentId",
                    label: "Select Existing Resident",
                    type: "select",
                    options: residentOptions,
                    placeholderOption: "Select a resident",
                    searchPlaceholder: "Search by name or email...",
                    searchable: true,
                    required: true,
                  }}
                  value={values.residentId}
                  values={values}
                  onChange={handleChange}
                />

                {selectedResident && (
                  <div className="modal__grid">
                    {getResidentDetails(selectedResident).map((field) => (
                      <ModalField
                        key={field.name}
                        field={{
                          name: field.name,
                          label: field.label,
                          type: "text",
                          readOnly: true,
                        }}
                        value={field.value ?? ""}
                        onChange={() => {}}
                      />
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="modal__grid">
                  <ModalField
                    field={{
                      name: "fullName",
                      label: "Full Name",
                      type: "text",
                      placeholder: "Full name",
                      required: true,
                    }}
                    value={newResident.fullName}
                    onChange={handleNewResidentChange}
                  />

                  <ModalField
                    field={{
                      name: "email",
                      label: "Email",
                      type: "email",
                      placeholder: "Email address",
                      required: true,
                    }}
                    value={newResident.email}
                    onChange={handleNewResidentChange}
                  />

                  <ModalField
                    field={{
                      name: "password",
                      label: "Password",
                      type: "password",
                      placeholder: "Minimum 8 characters",
                      required: true,
                    }}
                    value={newResident.password}
                    onChange={handleNewResidentChange}
                  />

                  <ModalField
                    field={{
                      name: "phone",
                      label: "Phone",
                      type: "tel",
                      placeholder: "Phone number",
                      required: true,
                    }}
                    value={newResident.phone}
                    onChange={handleNewResidentChange}
                  />

                  <ModalField
                    field={{
                      name: "gender",
                      label: "Gender",
                      type: "select",
                      options: GENDER_OPTIONS,
                      required: true,
                    }}
                    value={newResident.gender}
                    onChange={handleNewResidentChange}
                  />

                  <ModalField
                    field={{
                      name: "siteId",
                      label: "Site",
                      type: "select",
                      options: [
                        { value: "", label: "Select site" },
                        ...siteOptions,
                      ],
                      required: true,
                    }}
                    value={newResident.siteId}
                    onChange={handleNewResidentChange}
                  />

                  <ModalField
                    field={{
                      name: "nationality",
                      label: "Nationality",
                      type: "text",
                      placeholder: "Nationality",
                    }}
                    value={newResident.nationality}
                    onChange={handleNewResidentChange}
                  />

                  <ModalField
                    field={{
                      name: "mealType",
                      label: "Meal Type",
                      type: "text",
                      
                      required: true,
                    }}
                    value={newResident.mealType}
                    onChange={handleNewResidentChange}
                  />

                  <ModalField
                    field={{
                      name: "company",
                      label: "Company",
                      type: "text",
                      placeholder: "Company",
                    }}
                    value={newResident.company}
                    onChange={handleNewResidentChange}
                  />

                  <ModalField
                    field={{
                      name: "department",
                      label: "Department",
                      type: "text",
                      placeholder: "Department",
                    }}
                    value={newResident.department}
                    onChange={handleNewResidentChange}
                  />

                  <ModalField
                    field={{
                      name: "title",
                      label: "Title",
                      type: "text",
                      placeholder: "Title",
                    }}
                    value={newResident.title}
                    onChange={handleNewResidentChange}
                  />
                </div>

                {siteOptions.length === 0 && (
                  <p className="muted">
                    No sites are available. A resident cannot be created
                    without a site.
                  </p>
                )}
              </>
            )}
          </section>

          <section className="modal__section">
            <h3 className="modal__section-title">2. Booking Data</h3>

            <div className="modal__grid">
              <ModalField
                field={{
                  name: "bedId",
                  label: "Vacant Bed",
                  type: "select",
                  options: bedOptions,
                  placeholderOption: "Select a vacant bed",
                  searchPlaceholder: "Search by room or bed...",
                  searchable: true,
                  required: true,
                }}
                value={values.bedId}
                values={values}
                onChange={handleChange}
              />

              <ModalField
                field={{
                  name: "startedAt",
                  label: "Start Date",
                  type: "date",
                  required: true,
                }}
                value={values.startedAt}
                onChange={handleChange}
              />

              <ModalField
                field={{
                  name: "endedAt",
                  label: "End Date",
                  type: "date",
                  required: true,
                }}
                value={values.endedAt}
                onChange={handleChange}
              />
            </div>

            <ModalField
              field={{
                name: "notes",
                label: "Notes",
                type: "textarea",
                placeholder: "Add notes (optional)",
              }}
              value={values.notes}
              onChange={handleChange}
            />
          </section>

          {error && <p className="error-text">{error}</p>}
          <div className="modal__actions">
            <button type="button" className="btn btn-neutral" onClick={onClose}>
              Cancel
            </button>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={isLoading || isSubmitting}
            >
              {isSubmitting ? "Creating..." : "Create Booking"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
