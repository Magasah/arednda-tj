"""listings.deleted_at: удаление объявления отличается от скрытия

Revision ID: 0006
Revises: 0005
Create Date: 2026-09-28 09:00:00+00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # inactive + deleted_at IS NULL — скрыто владельцем (можно вернуть в ленту);
    # deleted_at задан — удалено: пропадает из «моих объявлений», правки запрещены.
    # Строка остаётся: на неё ссылаются брони и отзывы
    op.add_column("listings", sa.Column("deleted_at", sa.DateTime(timezone=True)))


def downgrade() -> None:
    op.drop_column("listings", "deleted_at")
