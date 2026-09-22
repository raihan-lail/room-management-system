# ROOM-MANAGEMENT-SYSTEMS

 room management systems built with:
 - `backend`: FastAPI + Postgresql (run on docker (recommended)) with alembic 
- `frontend`: React + Vite

## FRONTEND
### TECH STACK
- React
- Vite
- Tailwind CSS
- ESLint
- Javascript
### Installation
make sure you are in the frontend directory:
```bash
cd frontend
```
install the npm:
```bash
npm run dev
```
the web should be at:
```bash
http://localhost:5173/
```
note: the frontend currently not connected to the backend, i'll work on it later

## BACKEND:

### TECH STACK:
- Python 3.13+
- FastAPI
- PostgreSQL
- SQLAlchemy 2.0
- asyncpg
- Alembic
- Pydantic Settings
- WebSocket for real-time room rendering

### PREQUISITIES
Before running the project, make sure you have installed:

- Python 3.13 or newer
- PostgreSQL 16/17 or newer
- Git
- Optional: Docker and Docker Compose

check python:
```bash
python --version
```
check postgresql:
```bash
psql --version
```

### 1. Clone the Repository
```bash
git clone https://github.com/FuTour-App/room-management-system 
cd backend
```
If the repository is already available locally:
```bash
cd backend
```

### 2. Create a Virtual Environment
create the virtual environment:
```bash
python -m venv .venv
```
Activate it on Windows PowerShell:
```bash
.\.venv\Scripts\Activate.ps1
```
After activation, the terminal should look similar to:

```bash
(.venv) PS D:room-management-system\backend
```
Verify Python:
```bash
python --version
```
Verify pip:
```bash
pip --version
```
Make sure pip points to the .venv directory.

### 3. Install Dependencies
Install the project's dependencies:
```bash
pip install -r requirements.txt
```
if requirements.txt does not exist yet, install the required packages:
```bash
pip install fastapi "uvicorn[standard]" sqlalchemy asyncpg alembic pydantic-settings
```
Then generate the requirements file:
```bash
pip freeze > requirements.txt
```

### 4. Setup Postgresql
#### option 1, use local postgresql
Create a database using PostgreSQL:
```bash
CREATE DATABASE room_management;
```
Example database configuration:
- Host: localhost Port: 
- 5432 Database: 
- room_management 
- Username: postgres 
- Password: your_password
#### option 2, use docker (recommended)
If you prefer Docker, create a file in /backend:

docker-compose.yml

with the content:
```
services: 
    postgres: 
        image: postgres:17 
        container_name: room-management-postgres restart: unless-stopped 
        environment: 
            POSTGRES_USER: postgres 
            POSTGRES_PASSWORD: postgres 
            POSTGRES_DB: room_management 
        ports: - "5432:5432" 
        volumes: - postgres_data:/var/lib/postgresql/data 
    volumes: postgres_data:
```
 Start Postgresql:
 ```bash
 docker compose up -d
 ```
 Check that the container is running:
 ```bash
 docker ps
 ```
 You should see:
 ```bash
 room-management-postgres
 ```

 To stop Postgresql:
 ```bash
 docker compose down
 ```

### 4. Setup .env
Create a .env file in the backend root directory, and fill with this (example):
```
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/room_management
JWT_SECRET=your-jwt-secret
JWT_ALGORITHM=HS256
JWT_EXPIRES_HOURS=8
CORS_ORIGINS=http://localhost:5173,http://localhost:8080

```
For a local PostgreSQL installation, replace the username and password accordingly:
```
DATABASE_URL=postgresql+asyncpg://postgres:your_password@localhost:5432/room_management
```
#### Important!!!
never commit .env to git, make sure it included in .gitignore (make a new one if it not existed).

### 6. Configure the Database
The project uses SQLAlchemy with the asynchronous PostgreSQL driver asyncpg.

Example database configuration:
```
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=True,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

class Base(DeclarativeBase):
    pass

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
```
this already existed and configured in app/core/database.py

### 7. Run Database Migration
This project uses Alembic to manage database schema changes.

After configuring your .env, run:
```bash
alembic upgrade head
```
This applies all available migrations to PostgreSQL.

Check the current migration:
```bash
alembic current
```
Check migration history:
```bash
alembic history
```
### 8. Create a New Migration
Whenever you modify a SQLAlchemy model, generate a new migration.

Example:
```bash
alembic revision --autogenerate -m "create rooms table"
```
Review the generated migration inside:
```bash
alembic/versions/
```
Then apply it:
```bash
alembic upgrade head
```
Do not manually modify the production database schema when the change should be managed by Alembic.

### 9. Run the Server
start the development server
```bash
uvicorn app.main:app --reload
```
The API will be available at:
```bash
http://localhost:8000
```
### 10. API Documentation
FastAPI automatically provides interactive API documentation.
#### Swagger UI
```bash
http://localhost:8000/docs
```
#### ReDoc
```bash
http://localhost:8000/redoc
```
#### OpenAPI Schema
```bash
http://localhost:8000/openapi.json
```
