"""initial_tables: categories, listings, bookings, escrow_txns, reviews

Revision ID: 0002
Revises: 0001
Create Date: 2026-09-26 10:01:37.438808+00:00
"""

from collections.abc import Sequence

import geoalchemy2
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # btree_gist — для EXCLUDE-ограничения по (listing_id =, daterange &&) в bookings
    op.execute("CREATE EXTENSION IF NOT EXISTS btree_gist")

    op.create_table(
        "categories",
        sa.Column("id", sa.Integer(), sa.Identity(always=False), nullable=False),
        sa.Column("slug", sa.String(length=50), nullable=False),
        sa.Column("name_ru", sa.String(length=100), nullable=False),
        sa.Column("name_tj", sa.String(length=100), nullable=False),
        sa.Column("icon", sa.String(length=64), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_categories")),
        sa.UniqueConstraint("slug", name=op.f("uq_categories_slug")),
    )
    op.create_table(
        "listings",
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column("category_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("price_per_day", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column(
            "deposit_amount",
            sa.Numeric(precision=12, scale=2),
            server_default=sa.text("0"),
            nullable=False,
        ),
        sa.Column("city", sa.String(length=80), nullable=False),
        sa.Column("lat", sa.Float(), nullable=True),
        sa.Column("lng", sa.Float(), nullable=True),
        sa.Column(
            "location",
            geoalchemy2.types.Geography(
                geometry_type="POINT",
                srid=4326,
                dimension=2,
                spatial_index=False,
                from_text="ST_GeogFromText",
                name="geography",
            ),
            sa.Computed(
                "CASE WHEN lat IS NOT NULL AND lng IS NOT NULL THEN ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography END",
                persisted=True,
            ),
            nullable=True,
        ),
        sa.Column(
            "photos",
            sa.ARRAY(sa.String(length=512)),
            server_default=sa.text("'{}'::varchar[]"),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.Enum(
                "active",
                "inactive",
                "rented",
                name="listing_status",
                native_enum=False,
                create_constraint=False,
                length=16,
            ),
            server_default="active",
            nullable=False,
        ),
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
        sa.CheckConstraint(
            "status IN ('active', 'inactive', 'rented')", name=op.f("ck_listings_listing_status")
        ),
        sa.CheckConstraint("(lat IS NULL) = (lng IS NULL)", name=op.f("ck_listings_coords_pair")),
        sa.CheckConstraint("deposit_amount >= 0", name=op.f("ck_listings_deposit_non_negative")),
        sa.CheckConstraint("lat BETWEEN -90 AND 90", name=op.f("ck_listings_lat_range")),
        sa.CheckConstraint("lng BETWEEN -180 AND 180", name=op.f("ck_listings_lng_range")),
        sa.CheckConstraint("price_per_day > 0", name=op.f("ck_listings_price_positive")),
        sa.ForeignKeyConstraint(
            ["category_id"],
            ["categories.id"],
            name=op.f("fk_listings_category_id_categories"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["owner_id"], ["users.id"], name=op.f("fk_listings_owner_id_users"), ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_listings")),
    )
    op.create_index(
        "ix_listings_category_id_status", "listings", ["category_id", "status"], unique=False
    )
    op.create_index(op.f("ix_listings_city"), "listings", ["city"], unique=False)
    op.create_index(
        "ix_listings_location", "listings", ["location"], unique=False, postgresql_using="gist"
    )
    op.create_index(op.f("ix_listings_owner_id"), "listings", ["owner_id"], unique=False)
    op.create_table(
        "bookings",
        sa.Column("listing_id", sa.Uuid(), nullable=False),
        sa.Column("renter_id", sa.Uuid(), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("total_price", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("deposit_amount", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "pending",
                "payment_frozen",
                "active",
                "return_pending",
                "completed",
                "cancelled",
                "disputed",
                "resolved",
                name="booking_status",
                native_enum=False,
                create_constraint=False,
                length=20,
            ),
            server_default="pending",
            nullable=False,
        ),
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
        postgresql.ExcludeConstraint(
            (sa.column("listing_id"), "="),
            (sa.text("daterange(start_date, end_date, '[]')"), "&&"),
            where=sa.text("status <> 'cancelled'"),
            using="gist",
            name="ex_bookings_no_overlap",
        ),
        sa.CheckConstraint(
            "status IN ('pending', 'payment_frozen', 'active', 'return_pending', 'completed', 'cancelled', 'disputed', 'resolved')",
            name=op.f("ck_bookings_booking_status"),
        ),
        sa.CheckConstraint("deposit_amount >= 0", name=op.f("ck_bookings_deposit_non_negative")),
        sa.CheckConstraint("end_date >= start_date", name=op.f("ck_bookings_dates_order")),
        sa.CheckConstraint("total_price >= 0", name=op.f("ck_bookings_total_price_non_negative")),
        sa.ForeignKeyConstraint(
            ["listing_id"],
            ["listings.id"],
            name=op.f("fk_bookings_listing_id_listings"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["renter_id"],
            ["users.id"],
            name=op.f("fk_bookings_renter_id_users"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_bookings")),
    )
    op.create_index(op.f("ix_bookings_listing_id"), "bookings", ["listing_id"], unique=False)
    op.create_index(op.f("ix_bookings_renter_id"), "bookings", ["renter_id"], unique=False)
    op.create_index(op.f("ix_bookings_status"), "bookings", ["status"], unique=False)
    op.create_table(
        "escrow_txns",
        sa.Column("booking_id", sa.Uuid(), nullable=False),
        sa.Column("amount", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("deposit", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "frozen",
                "released",
                "returned",
                "partial_returned",
                name="escrow_status",
                native_enum=False,
                create_constraint=False,
                length=20,
            ),
            server_default="frozen",
            nullable=False,
        ),
        sa.Column("provider", sa.String(length=32), server_default="alif", nullable=False),
        sa.Column("provider_tx_id", sa.String(length=128), nullable=True),
        sa.Column("frozen_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("released_at", sa.DateTime(timezone=True), nullable=True),
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
        sa.CheckConstraint(
            "status IN ('frozen', 'released', 'returned', 'partial_returned')",
            name=op.f("ck_escrow_txns_escrow_status"),
        ),
        sa.CheckConstraint("amount >= 0", name=op.f("ck_escrow_txns_amount_non_negative")),
        sa.CheckConstraint("deposit >= 0", name=op.f("ck_escrow_txns_deposit_non_negative")),
        sa.ForeignKeyConstraint(
            ["booking_id"],
            ["bookings.id"],
            name=op.f("fk_escrow_txns_booking_id_bookings"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_escrow_txns")),
        sa.UniqueConstraint("booking_id", name=op.f("uq_escrow_txns_booking_id")),
        sa.UniqueConstraint("provider_tx_id", name=op.f("uq_escrow_txns_provider_tx_id")),
    )
    op.create_table(
        "reviews",
        sa.Column("booking_id", sa.Uuid(), nullable=False),
        sa.Column("from_user_id", sa.Uuid(), nullable=False),
        sa.Column("to_user_id", sa.Uuid(), nullable=False),
        sa.Column("rating", sa.SmallInteger(), nullable=False),
        sa.Column("text", sa.Text(), nullable=True),
        sa.Column("fraud_score", sa.Float(), server_default=sa.text("0"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.CheckConstraint(
            "fraud_score BETWEEN 0 AND 1", name=op.f("ck_reviews_fraud_score_range")
        ),
        sa.CheckConstraint("from_user_id <> to_user_id", name=op.f("ck_reviews_not_self")),
        sa.CheckConstraint("rating BETWEEN 1 AND 5", name=op.f("ck_reviews_rating_range")),
        sa.ForeignKeyConstraint(
            ["booking_id"],
            ["bookings.id"],
            name=op.f("fk_reviews_booking_id_bookings"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["from_user_id"],
            ["users.id"],
            name=op.f("fk_reviews_from_user_id_users"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["to_user_id"],
            ["users.id"],
            name=op.f("fk_reviews_to_user_id_users"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_reviews")),
        sa.UniqueConstraint(
            "booking_id", "from_user_id", name="uq_reviews_booking_id_from_user_id"
        ),
    )
    op.create_index(op.f("ix_reviews_from_user_id"), "reviews", ["from_user_id"], unique=False)
    op.create_index(op.f("ix_reviews_to_user_id"), "reviews", ["to_user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_reviews_to_user_id"), table_name="reviews")
    op.drop_index(op.f("ix_reviews_from_user_id"), table_name="reviews")
    op.drop_table("reviews")
    op.drop_table("escrow_txns")
    op.drop_index(op.f("ix_bookings_status"), table_name="bookings")
    op.drop_index(op.f("ix_bookings_renter_id"), table_name="bookings")
    op.drop_index(op.f("ix_bookings_listing_id"), table_name="bookings")
    op.drop_table("bookings")
    op.drop_index(op.f("ix_listings_owner_id"), table_name="listings")
    op.drop_index("ix_listings_location", table_name="listings", postgresql_using="gist")
    op.drop_index(op.f("ix_listings_city"), table_name="listings")
    op.drop_index("ix_listings_category_id_status", table_name="listings")
    op.drop_table("listings")
    op.drop_table("categories")
