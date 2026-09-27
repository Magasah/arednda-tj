"""Бронь держит даты только в активных статусах (completed/resolved освобождают даты)

Revision ID: 0003
Revises: 0002
Create Date: 2026-09-26 11:00:00+00:00
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_NEW_WHERE = "status IN ('pending', 'payment_frozen', 'active', 'return_pending', 'disputed')"
_OLD_WHERE = "status <> 'cancelled'"


def _recreate(where: str) -> None:
    op.execute("ALTER TABLE bookings DROP CONSTRAINT ex_bookings_no_overlap")
    op.execute(
        "ALTER TABLE bookings ADD CONSTRAINT ex_bookings_no_overlap "
        "EXCLUDE USING gist (listing_id WITH =, daterange(start_date, end_date, '[]') WITH &&) "
        f"WHERE ({where})"
    )


def upgrade() -> None:
    _recreate(_NEW_WHERE)


def downgrade() -> None:
    _recreate(_OLD_WHERE)
