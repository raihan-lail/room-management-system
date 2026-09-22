from typing import List

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.employee import Employee
from app.models.role_permission import RolePermission


class Role(Base):
    __tablename__ = "roles"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True
    )

    name: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False
    )

    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True
    )

    employees: Mapped[List["Employee"]] = relationship(
        back_populates="role"
    )

    role_permissions: Mapped[List["RolePermission"]] = relationship(
        back_populates="role",
        cascade="all, delete-orphan"
    )