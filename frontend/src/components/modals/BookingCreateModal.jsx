import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import apiRequest from "../../api/client";
import useAuth from "../../contexts/useAuth";
import { COUNTRIES } from "../../data/countries";
import { ModalField } from "./AddModal";

const GENDER_OPTIONS = [
  { value: "", label: "Select gender" },
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "OTHER", label: "Other" },
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
  phone: "",
  gender: "",
  siteId: "",
  nationality: "",
  mealType: "REGULAR",
  company: "",
  department: "",
  title: "",
};

/*
 * Open ended bookings are stored with a one year
 * end date. Feb 29 is clamped to Feb 28 so the
 * result always stays a valid date.
 */
function addOneYear(isoDate) {
  if (!isoDate) return "";

  const date = new Date(`${isoDate}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) return "";

  const month = date.getUTCMonth();

  date.setUTCFullYear(date.getUTCFullYear() + 1);

  if (date.getUTCMonth() !== month) {
    date.setUTCDate(0);
  }

  return date.toISOString().slice(0, 10);
}

function getActiveFloors(location) {
  return (location?.floors ?? []).filter((floor) => floor.isActive !== false);
}

function SummaryItem({ label, value }) {
  return (
    <div className="detail-grid__item">
      <p className="detail-grid__label">{label}</p>
      <p className="detail-grid__value">{value || "-"}</p>
    </div>
  );
}



export default function BookingCreateModal({ onClose, onCreated, initialValues, lockedBed }) {
  const { user, hasPermission } = useAuth();
  const canManageResidents = hasPermission("resident.manage");

  const [residents, setResidents] = useState([]);
  const [beds, setBeds] = useState([]);
  const [sites, setSites] = useState([]);
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState("");
  const [selectedFloor, setSelectedFloor] = useState("");
  const [values, setValues] = useState(() => ({ ...EMPTY_VALUES, ...initialValues }));
  const [residentMode, setResidentMode] = useState("existing");
  const [newResident, setNewResident] = useState(EMPTY_NEW_RESIDENT);
  const [noEndDate, setNoEndDate] = useState(false);
  const [step, setStep] = useState("form");

  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingBeds, setIsLoadingBeds] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const modalRef = useRef(null);

  useEffect(() => {
    modalRef.current?.scrollTo({ top: 0 });
  }, [step]);

  const loadOptions = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const requests = [
        apiRequest("/api/resident?pageSize=100"),
        canManageResidents
          ? apiRequest("/api/site").catch(() => null)
          : Promise.resolve(null),
        apiRequest("/api/location").catch(() => null),
      ];

      const [residentResponse, siteResponse, locationResponse] =
        await Promise.all(requests);

      setResidents(
        Array.isArray(residentResponse?.residents)
          ? residentResponse.residents
          : [],
      );

      const siteList = Array.isArray(siteResponse?.data)
        ? siteResponse.data
        : [];

      setSites(siteList);
      setLocations(Array.isArray(locationResponse?.data) ? locationResponse.data : []);

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

  const autoEndedAt = noEndDate ? addOneYear(values.startedAt) : "";
  const effectiveEndedAt = noEndDate ? autoEndedAt : values.endedAt;

  const hasValidStayDates = Boolean(
    values.startedAt && effectiveEndedAt && values.startedAt < effectiveEndedAt,
  );

  useEffect(() => {
  if (!hasValidStayDates || !selectedLocation || !selectedFloor || lockedBed) {
    // Defer the state updates to satisfy the linter
    queueMicrotask(() => {
      setBeds([]);
      if (!lockedBed) {
        setValues((prev) => ({ ...prev, bedId: "" }));
      }
      setIsLoadingBeds(false);
    });
    return undefined;
  }

  let isCurrentRequest = true;
  const loadAvailableBeds = async () => {
    setIsLoadingBeds(true);
    setError("");
    try {
      const params = new URLSearchParams({
        status: "VACANT",
        pageSize: "100",
        locationId: selectedLocation,
        floorId: selectedFloor,
        startDate: values.startedAt,
        endDate: effectiveEndedAt,
      });
      const response = await apiRequest(`/api/bed?${params.toString()}`);
      if (!isCurrentRequest) return;
      const availableBeds = Array.isArray(response?.beds) ? response.beds : [];
      setBeds(availableBeds.filter(
        (bed) => bed.isActive !== false && bed.room?.isBookable !== false,
      ));
    } catch (err) {
      if (isCurrentRequest) {
        setBeds([]);
        setError(err.message || "Failed to load available beds.");
      }
    } finally {
      if (isCurrentRequest) setIsLoadingBeds(false);
    }
  };

  loadAvailableBeds();
  return () => {
    isCurrentRequest = false;
  };
}, [hasValidStayDates, values.startedAt, effectiveEndedAt, selectedLocation, selectedFloor, lockedBed]);

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

  const locationOptions = useMemo(
    () => locations.map((location) => ({ value: location.id, label: location.name })),
    [locations],
  );
  const floorOptions = useMemo(() => {
    const location = locations.find((item) => item.id === selectedLocation);

    return getActiveFloors(location).map((floor) => ({
      value: floor.id,
      label: floor.name,
    }));
  }, [locations, selectedLocation]);

  const selectedResident = useMemo(
    () =>
      residents.find((resident) => resident.id === values.residentId) ?? null,
    [residents, values.residentId],
  );

  const selectedBed = useMemo(
    () => lockedBed ?? beds.find((bed) => bed.id === values.bedId) ?? null,
    [lockedBed, beds, values.bedId],
  );

  const genderLabel =
    GENDER_OPTIONS.find(
      (option) =>
        option.value ===
        (residentMode === "new" ? newResident.gender : selectedResident?.gender),
    )?.label ?? "-";

  const siteLabel =
    residentMode === "new"
      ? siteOptions.find((option) => option.value === newResident.siteId)?.label
      : selectedResident?.site?.name;

  const locationLabel =
    selectedBed?.room?.floor?.location?.name ??
    locations.find((location) => location.id === selectedLocation)?.name;

  const floorLabel =
    selectedBed?.room?.floor?.name ??
    floorOptions.find((floor) => floor.value === selectedFloor)?.label;

  const residentSummary =
    residentMode === "new"
      ? [
          { label: "Full Name", value: newResident.fullName },
          { label: "Email", value: newResident.email },
          { label: "Phone", value: newResident.phone },
          { label: "Gender", value: genderLabel },
          { label: "Nationality", value: newResident.nationality },
          { label: "Meal Type", value: newResident.mealType },
          { label: "Company", value: newResident.company },
          { label: "Department", value: newResident.department },
          { label: "Title", value: newResident.title },
          { label: "Site", value: siteLabel },
        ]
      : [
          { label: "Full Name", value: selectedResident?.fullName },
          { label: "Email", value: selectedResident?.user?.email },
          { label: "Phone", value: selectedResident?.phone },
          { label: "Gender", value: genderLabel },
          { label: "Nationality", value: selectedResident?.nationality },
          { label: "Meal Type", value: selectedResident?.mealType },
          { label: "Company", value: selectedResident?.company },
          { label: "Department", value: selectedResident?.department },
          { label: "Title", value: selectedResident?.title },
          { label: "Site", value: siteLabel },
        ];

  const bookingSummary = [
    { label: "Location", value: locationLabel },
    { label: "Floor", value: floorLabel },
    { label: "Room", value: selectedBed?.room?.name },
    { label: "Bed", value: selectedBed?.name },
    { label: "Start Date", value: values.startedAt },
    { label: "End Date", value: effectiveEndedAt },
    { label: "Open-ended", value: noEndDate ? "Yes" : "No" },
    { label: "Notes", value: values.notes.trim() },
  ];

  

  const handleChange = (name, value) => {
    setError("");

    if (name === "startedAt" && !value) {
      setNoEndDate(false);
    }

    setValues((prev) => {
      const next = {
        ...prev,
        [name]: value,
      };

      if (name === "startedAt" || name === "endedAt") {
        next.bedId = lockedBed ? prev.bedId : "";
      }

      if (name === "startedAt" && !value) {
        next.endedAt = "";
      }

      /*
       * Moving the start date past the current end
       * date would leave the stay invalid.
       */
      if (
        name === "startedAt" &&
        !noEndDate &&
        next.endedAt &&
        value >= next.endedAt
      ) {
        next.endedAt = "";
      }

      return next;
    });
  };

  const handleLocationChange = (_name, value) => {
    setError("");
    setSelectedLocation(value);

    /*
     * Selecting a location should make its first active
     * floor effective so the vacant beds load right away.
     */
    const location = locations.find((item) => item.id === value);
    const [firstFloor] = getActiveFloors(location);

    setSelectedFloor(firstFloor?.id ?? "");
    setValues((prev) => ({ ...prev, bedId: "" }));
  };

  const handleFloorChange = (_name, value) => {
    setError("");
    setSelectedFloor(value);
    setValues((prev) => ({ ...prev, bedId: "" }));
  };

  const handleNewResidentChange = (name, value) => {
    setError("");
    setNewResident((prev) => ({ ...prev, [name]: value }));
  };

  const handleNoEndDateChange = (checked) => {
    setNoEndDate(checked);
    setError("");

    /*
     * The effective stay dates change, so the
     * previously chosen bed may no longer be free.
     */
    setValues((prev) => ({
      ...prev,
      bedId: lockedBed ? prev.bedId : "",
    }));
  };

  const handleResidentModeChange = (mode) => {
    setResidentMode(mode);
    setError("");
  };

  const handleRequestClose = () => {
    if (isSubmitting) return;

    onClose();
  };

  const validateBooking = () => {
    if (residentMode === "existing" && !values.residentId) {
      return "Select a resident.";
    }

    if (residentMode === "new") {
      if (
        !newResident.fullName.trim() ||
        !newResident.email.trim() ||
        !newResident.phone.trim() ||
        !newResident.gender ||
        !newResident.siteId 
       
      ) {
        return "Fill in the required resident fields.";
      }
    }

    if (!values.startedAt || !effectiveEndedAt) {
      return "Select the stay start and end dates.";
    }

    const startedAt = new Date(`${values.startedAt}T00:00:00.000Z`);
    const endedAt = new Date(`${effectiveEndedAt}T00:00:00.000Z`);

    if (
      Number.isNaN(startedAt.getTime()) ||
      Number.isNaN(endedAt.getTime()) ||
      startedAt >= endedAt
    ) {
      return "The end date must be after the start date.";
    }

    if (!values.bedId) {
      return "Select a vacant bed.";
    }

    return "";
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const validationError = validateBooking();

    if (validationError) {
      setError(validationError);
      return;
    }

    setError("");
    setStep("confirm");
  };

  const handleConfirm = async (event) => {
    event.preventDefault();

    const startedAt = new Date(`${values.startedAt}T00:00:00.000Z`);
    const endedAt = new Date(`${effectiveEndedAt}T00:00:00.000Z`);

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
            siteId: newResident.siteId,
            fullName: newResident.fullName.trim(),
            phone: newResident.phone.trim(),
            gender: newResident.gender,
            nationality: newResident.nationality.trim() || undefined,
            mealType: newResident.mealType || undefined,
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

      setStep("form");

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

  const modalTitle = step === "confirm" ? "Confirm Booking" : "Create Booking";

  return (
    <div className="modal-overlay" onMouseDown={handleRequestClose}>
      <div
        ref={modalRef}
        className="modal modal--wide"
        role="dialog"
        aria-modal="true"
        aria-label={modalTitle}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal__header">
          <h2 className="modal__title">{modalTitle}</h2>

          <button
            type="button"
            className="modal__close"
            onClick={handleRequestClose}
            aria-label="Close"
            disabled={isSubmitting}
          >
            <i className="bi bi-x-lg" aria-hidden="true" />
          </button>
        </div>

        {step === "confirm" ? (
          <form
            className="modal__form"
            onSubmit={handleConfirm}
            aria-busy={isSubmitting}
          >
            <p className="muted">
              Review the resident and booking details before creating this
              booking.
            </p>

            <section className="modal__section">
              <h3 className="modal__section-title">Resident</h3>

              {residentMode === "new" && (
                <p className="muted">
                  A new resident will be created with this booking.
                </p>
              )}

              <div className="detail-grid">
                {residentSummary.map((field) => (
                  <SummaryItem
                    key={field.label}
                    label={field.label}
                    value={field.value}
                  />
                ))}
              </div>
            </section>

            <section className="modal__section">
              <h3 className="modal__section-title">Booking</h3>

              <div className="detail-grid">
                {bookingSummary.map((field) => (
                  <SummaryItem
                    key={field.label}
                    label={field.label}
                    value={field.value}
                  />
                ))}
              </div>
            </section>

            <div className="modal__actions">
              <button
                type="button"
                className="btn btn-neutral"
                onClick={() => setStep("form")}
                disabled={isSubmitting}
              >
                Edit
              </button>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Creating..." : "Confirm Booking"}
              </button>
            </div>
          </form>
        ) : (
          <form className="modal__form" onSubmit={handleSubmit} aria-busy={isSubmitting}>
          {isLoading && (
            <p className="muted">Loading options...</p>
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

                {!isLoading && !error && residents.length === 0 && (
                  <p className="muted">
                    No residents found.
                    {canManageResidents
                      ? " Use Add new resident to create one."
                      : ""}
                  </p>
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
                      name: "phone",
                      label: "Phone",
                      type: "tel",
                      placeholder: "+6281234567890",
                      required: true,
                      pattern: "\\+[1-9][0-9]{6,14}",
                      title: "Enter an international number starting with +, followed by 7 to 15 digits.",
                      helpText: "Must be started with +62 (or other countries format)",
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
                      type: "select",
                      options: COUNTRIES,
                      placeholderOption: "Select country",
                      searchable: true,
                      searchPlaceholder: "Search country...",
                    }}
                    value={newResident.nationality}
                    onChange={handleNewResidentChange}
                  />

                  <ModalField
                    field={{
                      name: "mealType",
                      label: "Meal Type",
                      type: "text",
                      
                      
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
            <h3 className="modal__section-title">2. Stay &amp; Bed</h3>

            <div className="modal__grid">
              {lockedBed ? (
                <>
                  <label className="form-field">
                    <span>Room</span>
                    <input type="text" value={lockedBed.room?.name ?? "Room"} readOnly />
                  </label>
                  <label className="form-field">
                    <span>Bed</span>
                    <input type="text" value={lockedBed.name} readOnly />
                  </label>
                </>
              ) : null}

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
                  type: noEndDate ? "text" : "date",
                  required: true,
                  readOnly: noEndDate,
                  min: noEndDate ? undefined : values.startedAt || undefined,
                }}
                value={noEndDate ? autoEndedAt : values.endedAt}
                onChange={handleChange}
              />

              <label
                className={`modal__checkbox${values.startedAt ? "" : " is-disabled"}`}
                title={values.startedAt ? undefined : "Select a start date first"}
              >
                <input
                  type="checkbox"
                  checked={noEndDate}
                  disabled={!values.startedAt}
                  onChange={(event) =>
                    handleNoEndDateChange(event.target.checked)
                  }
                />
                <span>
                  No end booking (ends one year after the start date)
                </span>
              </label>

              {!lockedBed && (
                <>
                  <ModalField
                    field={{
                      name: "locationId",
                      label: "Location",
                      type: "select",
                      options: locationOptions,
                      placeholderOption: "Select a location",
                      required: true,
                    }}
                    value={selectedLocation}
                    onChange={handleLocationChange}
                  />

                  <ModalField
                    field={{
                      name: "floorId",
                      label: "Floor",
                      type: "select",
                      options: floorOptions,
                      placeholderOption: selectedLocation ? "Select a floor" : "Select a location first",
                      required: true,
                    }}
                    value={selectedFloor}
                    onChange={handleFloorChange}
                  />

                  <ModalField
                    field={{
                      name: "bedId",
                      label: "Vacant Bed",
                      type: "select",
                      options: bedOptions,
                      placeholderOption: !hasValidStayDates
                        ? "Select stay dates first"
                        : !selectedLocation || !selectedFloor
                          ? "Select a location and floor first"
                        : isLoadingBeds
                          ? "Loading available beds..."
                          : "Select a vacant bed",
                      searchPlaceholder: "Search by room or bed...",
                      searchable: true,
                      required: true,
                    }}
                    value={values.bedId}
                    values={values}
                    onChange={handleChange}
                  />
                </>
              )}
            </div>

            {!lockedBed &&
              hasValidStayDates &&
              selectedLocation &&
              selectedFloor &&
              !isLoadingBeds && (
                <p className="muted">
                  {beds.length === 0
                    ? "No vacant beds are available for these dates."
                    : `${beds.length} vacant ${
                        beds.length === 1 ? "bed" : "beds"
                      } available for these dates.`}
                </p>
              )}

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

          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}
          <div className="modal__actions">
            <button
              type="button"
              className="btn btn-neutral"
              onClick={handleRequestClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={isLoading || isSubmitting}
            >
              {isSubmitting ? "Creating..." : "Review Booking"}
            </button>
          </div>
          </form>
        )}
      </div>
    </div>
  );
}
