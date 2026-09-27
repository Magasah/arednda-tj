"""Отзывы (скрытие/удаление), trust score 1..5, паспорт, bookings.completed_at

Revision ID: 0005
Revises: 0004
Create Date: 2026-09-27 09:00:00+00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # --- users: паспорт + trust score по шкале 1..5 (4.00 — нейтральный старт) ---
    op.add_column(
        "users",
        sa.Column(
            "passport_verified", sa.Boolean(), server_default=sa.text("false"), nullable=False
        ),
    )
    op.add_column("users", sa.Column("passport_verified_at", sa.DateTime(timezone=True)))
    op.add_column("users", sa.Column("passport_photo_key", sa.String(length=512)))

    op.drop_constraint(op.f("ck_users_trust_score_range"), "users", type_="check")
    op.execute("UPDATE users SET trust_score = 4.00")
    op.alter_column(
        "users",
        "trust_score",
        type_=sa.Numeric(precision=3, scale=2),
        existing_type=sa.Numeric(precision=5, scale=2),
        server_default=sa.text("4.00"),
        existing_nullable=False,
    )
    op.create_check_constraint(
        op.f("ck_users_trust_score_range"), "users", "trust_score >= 1 AND trust_score <= 5"
    )

    # --- bookings: момент завершения сделки ---
    op.add_column("bookings", sa.Column("completed_at", sa.DateTime(timezone=True)))
    op.execute("UPDATE bookings SET completed_at = updated_at WHERE status = 'completed'")

    # --- reviews: скрытие антифродом и мягкое удаление ---
    op.add_column(
        "reviews",
        sa.Column("is_hidden", sa.Boolean(), server_default=sa.text("false"), nullable=False),
    )
    op.add_column(
        "reviews",
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("false"), nullable=False),
    )
    op.add_column("reviews", sa.Column("deleted_at", sa.DateTime(timezone=True)))


def downgrade() -> None:
    op.drop_column("reviews", "deleted_at")
    op.drop_column("reviews", "is_deleted")
    op.drop_column("reviews", "is_hidden")
    op.drop_column("bookings", "completed_at")

    op.drop_constraint(op.f("ck_users_trust_score_range"), "users", type_="check")
    op.alter_column(
        "users",
        "trust_score",
        type_=sa.Numeric(precision=5, scale=2),
        existing_type=sa.Numeric(precision=3, scale=2),
        server_default=sa.text("0"),
        existing_nullable=False,
    )
    op.execute("UPDATE users SET trust_score = 0")
    op.create_check_constraint(
        op.f("ck_users_trust_score_range"), "users", "trust_score >= 0 AND trust_score <= 100"
    )
    op.drop_column("users", "passport_photo_key")
    op.drop_column("users", "passport_verified_at")
    op.drop_column("users", "passport_verified")
