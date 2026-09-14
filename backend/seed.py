"""
CTF Platform — Seed Data Script
Creates roles, a superadmin, an event admin, a challenge author,
a moderator, participants, a sample event, categories, and 10 challenges.

Usage:
    cd backend
    python seed.py
"""
import asyncio
import sys
import os

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

sys.path.insert(0, os.path.dirname(__file__))

from app.core.database import AsyncSessionLocal, create_tables
from app.core.security import hash_password, hash_flag
from app.models import *  # noqa — import all models


ROLES = [
    ("super_admin", "Full platform administrator"),
    ("event_admin", "Can manage assigned events"),
    ("challenge_author", "Can create and manage challenges"),
    ("moderator", "Can review submissions and users"),
    ("participant", "Standard competitor"),
]

SAMPLE_CHALLENGES = [
    ("Cookie Monster", "Web", "Find the hidden cookie in the HTTP response.", 100, "easy", "flag{cook13s_4r3_d3l1c10us}"),
    ("Base64 Bonanza", "Crypto", "Decode the encoded message: `ZmxhZ3tiYXNlNjRfaXNfbm90X2VuY3J5cHRpb259`", 50, "beginner", "flag{base64_is_not_encryption}"),
    ("Hidden in Plain Sight", "Steganography", "There's a flag hidden in the image. Can you find it?", 150, "medium", "flag{st3g4n0gr4phy_1s_fun}"),
    ("Wireshark Warrior", "Forensics", "Analyze the provided PCAP file and extract the flag.", 200, "medium", "flag{pcap_4nalys1s_pr0}"),
    ("Buffer Overflow 101", "Pwn", "Classic stack buffer overflow. Overflow the buffer to get the flag.", 300, "hard", "flag{smash_the_stack}"),
    ("RSA Challenge", "Crypto", "Can you factor this RSA modulus and decrypt the message?", 350, "hard", "flag{rsa_f4ct0r1ng_master}"),
    ("Google Dork", "OSINT", "Find information about the target company using only public sources.", 100, "easy", "flag{0s1nt_1s_p0w3rful}"),
    ("JWT Jailbreak", "Web", "This web app uses JWTs for authentication. Find the vulnerability.", 250, "medium", "flag{jwt_n0n3_alg0r1thm}"),
    ("Magic Bytes", "Forensics", "The file extension is wrong. Identify the real file type and extract the flag.", 75, "beginner", "flag{m4g1c_byt3s_r3v34l}"),
    ("Reversing Rookie", "Reverse Engineering", "Reverse engineer this binary to find the correct input that prints the flag.", 200, "medium", "flag{r3v3rs3_3ng1n33r1ng_101}"),
]


async def seed():
    print("🌱 Seeding CTF Platform database...")
    print("Creating tables if they do not exist...")
    await create_tables()

    async with AsyncSessionLocal() as db:
        # ── Roles ──────────────────────────────────────────────────────────
        print("Creating roles...")
        role_map = {}
        for name, desc in ROLES:
            existing = (await db.execute(
                __import__("sqlalchemy").select(Role).where(Role.name == name)
            )).scalar_one_or_none()
            if not existing:
                role = Role(name=name, description=desc)
                db.add(role)
                await db.flush()
                role_map[name] = role
            else:
                role_map[name] = existing
        await db.commit()

        # Reload roles
        for name in role_map:
            existing = (await db.execute(
                __import__("sqlalchemy").select(Role).where(Role.name == name)
            )).scalar_one_or_none()
            role_map[name] = existing

        # ── Users ──────────────────────────────────────────────────────────
        print("Creating users...")

        def make_user(email, username, display_name, password, role_names):
            user = User(
                email=email, username=username, display_name=display_name,
                hashed_password=hash_password(password), is_active=True, is_verified=True,
            )
            for rn in role_names:
                if rn in role_map:
                    user.roles.append(role_map[rn])
            return user

        seed_users = [
            ("superadmin@ctfplatform.dev", "superadmin", "Super Admin", "Admin@1234!", ["super_admin", "participant"]),
            ("eventadmin@ctfplatform.dev", "eventadmin", "Event Admin", "Event@1234!", ["event_admin", "participant"]),
            ("author@ctfplatform.dev", "challengeauthor", "Challenge Author", "Author@1234!", ["challenge_author", "participant"]),
            ("moderator@ctfplatform.dev", "moderator", "Moderator", "Mod@12345!", ["moderator", "participant"]),
            ("alice@example.com", "alice", "Alice", "Alice@1234!", ["participant"]),
            ("bob@example.com", "bob", "Bob", "Bob@12345!", ["participant"]),
        ]

        created_users = {}
        for email, username, display_name, password, role_names in seed_users:
            existing = (await db.execute(
                __import__("sqlalchemy").select(User).where(User.email == email)
            )).scalar_one_or_none()
            if not existing:
                user = make_user(email, username, display_name, password, role_names)
                db.add(user)
                await db.flush()
                created_users[username] = user
                print(f"  Created user: {username} ({', '.join(role_names)})")
            else:
                created_users[username] = existing
                print(f"  User exists: {username}")

        await db.commit()

        # ── Event ──────────────────────────────────────────────────────────
        print("Creating sample CTF event...")
        from datetime import datetime, timezone, timedelta
        from slugify import slugify

        event_admin = (await db.execute(
            __import__("sqlalchemy").select(User).where(User.username == "eventadmin")
        )).scalar_one_or_none()

        existing_event = (await db.execute(
            __import__("sqlalchemy").select(Event).where(Event.slug == "example-ctf-2026")
        )).scalar_one_or_none()

        if not existing_event:
            now = datetime.now(timezone.utc)
            event = Event(
                name="Example CTF 2026",
                slug="example-ctf-2026",
                description="A sample CTF event for development and testing. Contains 10 challenges across multiple categories.",
                rules="1. No sharing flags.\n2. Be respectful.\n3. Have fun!",
                start_date=now + timedelta(days=1),
                end_date=now + timedelta(days=3),
                registration_start=now - timedelta(hours=1),
                registration_end=now + timedelta(days=1),
                timezone="UTC",
                status=EventStatus.REGISTRATION_OPEN,
                visibility=EventVisibility.PUBLIC,
                scoring_type=ScoringType.STATIC,
                max_teams=50,
                team_size=4,
                created_by=event_admin.id if event_admin else None,
            )
            db.add(event)
            await db.flush()
            print(f"  Created event: {event.name}")

            # Score record will be created when teams are created
            # ── Categories ────────────────────────────────────────────────────
            category_map = {}
            cat_defs = [
                ("Web", "#3B82F6", "globe"),
                ("Crypto", "#8B5CF6", "lock"),
                ("Forensics", "#10B981", "search"),
                ("OSINT", "#F59E0B", "eye"),
                ("Pwn", "#EF4444", "terminal"),
                ("Reverse Engineering", "#6366F1", "code"),
                ("Steganography", "#EC4899", "image"),
            ]
            for cat_name, color, icon in cat_defs:
                cat = Category(
                    event_id=event.id,
                    name=cat_name,
                    slug=slugify(cat_name),
                    color=color,
                    icon=icon,
                )
                db.add(cat)
                await db.flush()
                category_map[cat_name] = cat

            # ── Challenges ────────────────────────────────────────────────────
            author = (await db.execute(
                __import__("sqlalchemy").select(User).where(User.username == "challengeauthor")
            )).scalar_one_or_none()

            for ch_name, cat_name, description, points, difficulty, flag_value in SAMPLE_CHALLENGES:
                cat = category_map.get(cat_name)
                ch = Challenge(
                    event_id=event.id,
                    category_id=cat.id if cat else None,
                    name=ch_name,
                    slug=slugify(ch_name),
                    description=description,
                    points=points,
                    current_points=points,
                    difficulty=Difficulty(difficulty),
                    author_id=author.id if author else None,
                    status=ChallengeStatus.PUBLISHED,
                )
                db.add(ch)
                await db.flush()

                # Add flag (hashed)
                flag = ChallengeFlag(
                    challenge_id=ch.id,
                    flag_type=FlagType.STATIC,
                    flag_value=hash_flag(flag_value),
                    is_case_sensitive=True,
                )
                db.add(flag)

                # Add a hint
                hint = ChallengeHint(
                    challenge_id=ch.id,
                    content=f"Think carefully about {cat_name.lower()} fundamentals.",
                    cost=25,
                    order_index=0,
                )
                db.add(hint)

            await db.commit()
            print(f"  Created {len(SAMPLE_CHALLENGES)} challenges with flags and hints")
        else:
            print("  Event already exists, skipping")

    print("\n✅ Seed complete!")
    print("\n📋 Test Credentials:")
    print("  superadmin@ctfplatform.dev / Admin@1234!")
    print("  eventadmin@ctfplatform.dev / Event@1234!")
    print("  author@ctfplatform.dev     / Author@1234!")
    print("  moderator@ctfplatform.dev  / Mod@12345!")
    print("  alice@example.com          / Alice@1234!")
    print("  bob@example.com            / Bob@12345!")
    print("\n🌐 API Docs: http://localhost:8000/api/docs")
    print("🌐 Frontend: http://localhost:3000")


if __name__ == "__main__":
    asyncio.run(seed())
