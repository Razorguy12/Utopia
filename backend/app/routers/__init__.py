from .auth import router as auth_router
from .projects import router as projects_router
from .issues import router as issues_router
from .conflicts import router as conflicts_router
from .onsite import router as onsite_router
from .geocode import router as geocode_router
from .broadcasts import router as broadcasts_router
from .media import router as media_router
from .ai_chat import router as ai_chat_router
from .contractors import router as contractors_router

__all__ = [
    "auth_router",
    "projects_router",
    "issues_router",
    "conflicts_router",
    "onsite_router",
    "geocode_router",
    "broadcasts_router",
    "media_router",
    "ai_chat_router", "contractors_router"
]
