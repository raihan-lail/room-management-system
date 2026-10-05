import MainLayout from "../../components/MainLayout";
import { useMemo, useState } from "react";
import AddModal from "../../components/modals/AddModal";
import {
  addFormSchemas,
  buildRow,
} from "../../components/modals/addFormSchemas";
import { employee as initialEmployee } from "../../data/employee";

const PAGE_SIZE = 10;

const employeeSchema = addFormSchemas.employee;

export default function EmployeeManagement() {
  const [employees, setEmployees] = useState(initialEmployee);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");

  const handleAddEmployee = (values) => {
    setEmployees((prev) => [...prev, buildRow(employeeSchema, values)]);
    setCurrentPage(1);
  };

  const filteredEmployee = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return employees;

    return employees.filter((employee) =>
      [
        employee.name,
        employee.Role,
        employee.Site,
        employee.Email,
        employee.Phone,
      ].some((value) => (value || "").toString().toLowerCase().includes(query)),
    );
  }, [employees, search]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredEmployee.length / PAGE_SIZE),
  );
  const safePage = Math.min(currentPage, totalPages);

  const pagedEmployee = useMemo(() => {
    const startIndex = (safePage - 1) * PAGE_SIZE;
    return filteredEmployee.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredEmployee, safePage]);

  const startRow =
    filteredEmployee.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const endRow = Math.min(safePage * PAGE_SIZE, filteredEmployee.length);

  const handleSearchChange = (value) => {
    setSearch(value);
    setCurrentPage(1);
  };
  return (
    <MainLayout>
      <div className="dashboard">
        <div className="dashboard-header">
          <div className="dashboard-header__text">
            <h1 className="dashboard-header__title">Employee Management</h1>
            <p className="dashboard-header__subtitle">
              Employee management will added here
            </p>
          </div>
        </div>

         <div className="bookings-toolbar form-actions">
          <label className="history-search">
            <i className="bi bi-search" aria-hidden="true" />
            <input
              type="search"
              aria-label="Search employee"
              placeholder="Search by name, site, role, email, phone..."
              value={search}
              onChange={(event) => handleSearchChange(event.target.value)}
            />
          </label>

          <div className="bookings-toolbar__actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setIsAddModalOpen(true)}
            >
              <i className="bi bi-plus-lg" aria-hidden="true" />
              Add New Employee
            </button>

            <button
              type="button"
              className="btn btn-neutral"
              onClick={() => console.log("Import Excel")}
            >
              <i className="bi bi-file-earmark-excel" aria-hidden="true" />
              Bulk Import
            </button>
             <button
              type="button"
              className="btn btn-neutral"
              onClick={() => console.log("Import Excel")}
            >
              <i className="bi bi-file-earmark-excel" aria-hidden="true" />
              Export Excel
            </button>
            
          </div>
        </div>


         <section className="table-card content">
          <div className="office-table-wrapper">
            <table className="office-table">
              <thead>
                <tr>
                  <th className="table-col-no">No</th>
                  <th>Name</th>
                  <th>Site</th>
                  <th>Role</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {pagedEmployee.length === 0 ? (
                  <tr>
                    <td colSpan="12" className="muted">
                      No employee found.
                    </td>
                  </tr>
                ) : (
                  pagedEmployee.map((employee, index) => (
                    <tr
                      key={`${index}`}
                    >
                      <td className="table-col-no">
                        {(safePage - 1) * PAGE_SIZE + index + 1}
                      </td>

                      <td>
                        {employee.name || "-"}
                      </td>

                      <td>{employee.Site}</td>

                      <td>{employee.Role}</td>

                      <td>{employee.Email}</td>

                      <td>{employee.Phone}</td>

                     

                      <td>
                        <div className="table-actions">
                          <button
                            type="button"
                            className="btn btn-neutral"
                            title={`View employee ${employee.name || "guest"}`}
                            onClick={() =>
                              console.log("View employee:", employee)
                            }
                          >
                            <i
                              className="bi bi-eye"
                              aria-hidden="true"
                            />
                          </button>

                          <button
                            type="button"
                            className="btn btn-neutral"
                            title={`Edit employee ${employee.name || "guest"}`}
                            onClick={() =>
                              console.log("Edit booking:", employee)
                            }
                          >
                            <i
                              className="bi bi-pencil-square"
                              aria-hidden="true"
                            />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* PAGINATION */}
          <div className="office-pagination">
            <span className="office-page-info">
              Showing {startRow}–{endRow} of {filteredEmployee.length} employees
            </span>

            <div className="office-page-nav">
              <button
                type="button"
                className="btn btn-neutral"
                disabled={safePage <= 1}
                onClick={() =>
                  setCurrentPage((prev) => Math.max(1, prev - 1))
                }
              >
                <i className="bi bi-chevron-left" aria-hidden="true" />
                Prev
              </button>

              <span className="office-page-info">
                Page {safePage} of {totalPages}
              </span>

              <button
                type="button"
                className="btn btn-neutral"
                disabled={safePage >= totalPages}
                onClick={() =>
                  setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                }
              >
                Next
                <i className="bi bi-chevron-right" aria-hidden="true" />
              </button>
            </div>
          </div>
        </section>
      </div>

      {isAddModalOpen && (
        <AddModal
          title={employeeSchema.title}
          submitLabel={employeeSchema.submitLabel}
          fields={employeeSchema.fields}
          onClose={() => setIsAddModalOpen(false)}
          onSubmit={handleAddEmployee}
        />
      )}
    </MainLayout>
  );
}
