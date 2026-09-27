"""Расширение PostGIS + таблица users

Revision ID: 0001
Revises:
Create Date: 2026-09-25 16:00:00+00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # PostGIS нужен для геопоиска объявлений (listings.location)
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")

    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("phone", sa.String(length=16), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=True),
        sa.Column("avatar_url", sa.String(length=512), nullable=True),
        sa.Column(
            "trust_score",
            sa.Numeric(precision=5, scale=2),
            server_default=sa.text("0"),
            nullable=False,
        ),
        sa.Column("verified", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column(
            "role",
            sa.Enum(
                "user",
                "admin",
                name="user_role",
                native_enum=False,
                length=16,
                create_constraint=False,
            ),
            server_default="user",
            nullable=False,
        ),
        sa.Column(
            "language",
            sa.Enum(
                "ru",
                "tg",
                name="user_language",
                native_enum=False,
                length=2,
                create_constraint=False,
            ),
            server_default="ru",
            nullable=False,
        ),
        sa.Column("telegram_id", sa.BigInteger(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "trust_score >= 0 AND trust_score <= 100", name=op.f("ck_users_trust_score_range")
        ),
        sa.CheckConstraint("phone ~ '^\\+[1-9][0-9]{7,14}$'", name=op.f("ck_users_phone_e164")),
        sa.CheckConstraint("role IN ('user', 'admin')", name=op.f("ck_users_user_role")),
        sa.CheckConstraint("language IN ('ru', 'tg')", name=op.f("ck_users_user_language")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_users")),
        sa.UniqueConstraint("telegram_id", name=op.f("uq_users_telegram_id")),
    )
    op.create_index(op.f("ix_users_phone"), "users", ["phone"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_users_phone"), table_name="users")
    op.drop_table("users")
    # Расширение postgis не удаляем — его могут использовать другие объекты
