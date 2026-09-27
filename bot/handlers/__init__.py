from aiogram import Router

from handlers import auth, booking, listings, notifications, profile, start


def build_router() -> Router:
    """Порядок важен: start (команды и ошибки) → вход → публичный каталог → защищённые разделы."""
    root = Router(name="root")
    root.include_routers(
        start.router,
        auth.router,
        listings.router,
        booking.router,
        profile.router,
        notifications.router,
    )
    return root
