import MainLayout from "../../components/MainLayout";


export default function EmailLog() {
    return (
        <MainLayout>
            <div className="dashboard">
                 <div className="dashboard-header">
          <div className="dashboard-header__text">
            <h1 className="dashboard-header__title">
              Email Logs
            </h1>

            <p className="dashboard-header__subtitle">
              Track sent emails.
            </p>
          </div>
        </div>

            </div>
        </MainLayout>
    )
}