"""FSM-состояния бота."""

from aiogram.fsm.state import State, StatesGroup


class AuthStates(StatesGroup):
    waiting_phone = State()
    waiting_code = State()


class BookingStates(StatesGroup):
    waiting_start_date = State()
    waiting_days = State()
    waiting_photo = State()  # фото при получении / возврате
    waiting_damage = State()  # описание повреждения (владелец)


class ReviewStates(StatesGroup):
    waiting_text = State()


class ProfileStates(StatesGroup):
    waiting_name = State()
