"""CTF Platform — Models package with all Beanie Document models."""
from app.models.user import User, Role, UserSession, PasswordResetToken, EmailVerificationToken, ApiKey
from app.models.event import Event, EventSetting, EventRegistration, EventStatus, EventVisibility, ScoringType, LeaderboardStatus, RegistrationStatus
from app.models.team import Team, TeamMember, TeamInvitation, TeamMemberRole, InvitationStatus
from app.models.challenge import Category, Challenge, ChallengeFlag, ChallengeHint, HintUnlock, ChallengeFile, ChallengeStatus, Difficulty, FlagType
from app.models.submission import Submission, Solve, SubmissionResult
from app.models.score import Score, ScoreEvent, Certificate
from app.models.notification import Announcement, Notification, AnnouncementVisibility, NotificationType
from app.models.audit import AuditLog

ALL_DOCUMENT_MODELS = [
    User,
    Role,
    UserSession,
    PasswordResetToken,
    EmailVerificationToken,
    ApiKey,
    Event,
    EventSetting,
    EventRegistration,
    Team,
    TeamMember,
    TeamInvitation,
    Category,
    Challenge,
    ChallengeFlag,
    ChallengeHint,
    HintUnlock,
    ChallengeFile,
    Submission,
    Solve,
    Score,
    ScoreEvent,
    Certificate,
    Announcement,
    Notification,
    AuditLog,
]
