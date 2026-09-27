"""add_handover_dispute: handovers, disputes, итоги эскроу, период брони [start, end)

Revision ID: 0004
Revises: 0003
Create Date: 2026-09-26 11:02:35.043163+00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

_EXCLUDE = (
    "ALTER TABLE bookings ADD CONSTRAINT ex_bookings_no_overlap "
    "EXCLUDE USING gist (listing_id WITH =, daterange(start_date, end_date, '{bounds}') WITH &&) "
    "WHERE (status IN ('pending', 'payment_frozen', 'active', 'return_pending', 'disputed'))"
)

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "disputes",
        sa.Column("booking_id", sa.Uuid(), nullable=False),
        sa.Column("opened_by", sa.Uuid(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "open",
                "resolved",
                "closed",
                name="dispute_status",
                native_enum=False,
                create_constraint=False,
                length=16,
            ),
            server_default="open",
            nullable=False,
        ),
        sa.Column("resolution", sa.Text(), nullable=True),
        sa.Column("damage_amount", sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.CheckConstraint(
            "status IN ('open', 'resolved', 'closed')", name=op.f("ck_disputes_dispute_status")
        ),
        sa.CheckConstraint(
            "damage_amount >= 0", name=op.f("ck_disputes_damage_amount_non_negative")
        ),
        sa.ForeignKeyConstraint(
            ["booking_id"],
            ["bookings.id"],
            name=op.f("fk_disputes_booking_id_bookings"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["opened_by"],
            ["users.id"],
            name=op.f("fk_disputes_opened_by_users"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_disputes")),
        sa.UniqueConstraint("booking_id", name=op.f("uq_disputes_booking_id")),
    )
    op.create_index(op.f("ix_disputes_opened_by"), "disputes", ["opened_by"], unique=False)
    op.create_index(op.f("ix_disputes_status"), "disputes", ["status"], unique=False)
    op.create_table(
        "handovers",
        sa.Column("booking_id", sa.Uuid(), nullable=False),
        sa.Column(
            "photos_before",
            sa.ARRAY(sa.String(length=512)),
            server_default=sa.text("'{}'::varchar[]"),
            nullable=False,
        ),
        sa.Column("photos_after", sa.ARRAY(sa.String(length=512)), nullable=True),
        sa.Column("qr_code", sa.String(length=128), nullable=True),
        sa.Column("handover_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("return_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
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
        sa.ForeignKeyConstraint(
            ["booking_id"],
            ["bookings.id"],
            name=op.f("fk_handovers_booking_id_bookings"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_handovers")),
        sa.UniqueConstraint("booking_id", name=op.f("uq_handovers_booking_id")),
    )
    op.create_index(op.f("ix_handovers_return_at"), "handovers", ["return_at"], unique=False)
    op.add_column(
        "escrow_txns", sa.Column("payout_amount", sa.Numeric(precision=12, scale=2), nullable=True)
    )
    op.add_column(
        "escrow_txns",
        sa.Column("deposit_refund_amount", sa.Numeric(precision=12, scale=2), nullable=True),
    )
    op.add_column(
        "escrow_txns", sa.Column("deposit_returned_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.create_check_constraint(
        op.f("ck_escrow_txns_payout_non_negative"), "escrow_txns", "payout_amount >= 0"
    )
    op.create_check_constraint(
        op.f("ck_escrow_txns_refund_non_negative"), "escrow_txns", "deposit_refund_amount >= 0"
    )

    # Период брони [start_date, end_date): день возврата свободен для следующей брони
    op.drop_constraint(op.f("ck_bookings_dates_order"), "bookings", type_="check")
    op.create_check_constraint(op.f("ck_bookings_dates_order"), "bookings", "end_date > start_date")
    op.execute("ALTER TABLE bookings DROP CONSTRAINT ex_bookings_no_overlap")
    op.execute(_EXCLUDE.format(bounds="[)"))


def downgrade() -> None:
    op.execute("ALTER TABLE bookings DROP CONSTRAINT ex_bookings_no_overlap")
    op.execute(_EXCLUDE.format(bounds="[]"))
    op.drop_constraint(op.f("ck_bookings_dates_order"), "bookings", type_="check")
    op.create_check_constraint(
        op.f("ck_bookings_dates_order"), "bookings", "end_date >= start_date"
    )
    op.drop_constraint(op.f("ck_escrow_txns_refund_non_negative"), "escrow_txns", type_="check")
    op.drop_constraint(op.f("ck_escrow_txns_payout_non_negative"), "escrow_txns", type_="check")
    op.drop_column("escrow_txns", "deposit_returned_at")
    op.drop_column("escrow_txns", "deposit_refund_amount")
    op.drop_column("escrow_txns", "payout_amount")
    op.drop_index(op.f("ix_handovers_return_at"), table_name="handovers")
    op.drop_table("handovers")
    op.drop_index(op.f("ix_disputes_status"), table_name="disputes")
    op.drop_index(op.f("ix_disputes_opened_by"), table_name="disputes")
    op.drop_table("disputes")
