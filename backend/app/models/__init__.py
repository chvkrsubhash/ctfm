"""CTF Platform — Models package. Import all models here so Alembic can discover them."""
from app.models.user import User, Role, Permission, UserSession, PasswordResetToken, EmailVerificationToken, ApiKey, user_roles, role_permissions  # noqa: F401
from app.models.event import Event, EventSetting, EventRegistration, EventStatus, EventVisibility, ScoringType, LeaderboardStatus, RegistrationStatus  # noqa: F401
from app.models.team import Team, TeamMember, TeamInvitation, TeamMemberRole, InvitationStatus  # noqa: F401
from app.models.challenge import Category, Challenge, ChallengeFlag, ChallengeHint, HintUnlock, ChallengeFile, ChallengeStatus, Difficulty, FlagType  # noqa: F401
from app.models.submission import Submission, Solve, SubmissionResult  # noqa: F401
from app.models.score import Score, ScoreEvent, Certificate  # noqa: F401
from app.models.notification import Announcement, Notification, AnnouncementVisibility, NotificationType  # noqa: F401
from app.models.audit import AuditLog  # noqa: F401
