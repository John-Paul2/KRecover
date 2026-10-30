# KRecover

**A verified, searchable lost & found board for the Karunya University campus.**

KRecover replaces scattered WhatsApp forwards, notice-board flyers and "has anyone seen my…" messages with one place where students can report what they lost, post what they found, and get matched with each other.

---

## The problem

On a large campus, losing something usually goes like this:

- You post in a few class or hostel groups and hope the right person sees it before it scrolls away.
- Whoever found your item has no obvious place to report it, so it sits at a security desk, in a department office, or in someone's bag.
- Lost and found reports never meet. "Black earphones, library" and "wireless earbuds near the reading hall" describe the same thing, but nobody connects them.
- Anyone can post anything, so there's no way to tell whether the person messaging you about your phone is actually a student.

The result is that items that *were* found still don't make it back to their owners.

## What KRecover does

| Problem | How KRecover handles it |
|---|---|
| Reports are scattered across groups and boards | One shared, real-time board of **Lost**, **Found** and **Resolved** items |
| You can't tell who you're dealing with | Sign-up is restricted to **@karunya.edu.in** emails and verified with a **6-digit email OTP**; every user has a name and register number on file |
| Lost and found posts describe the same item differently | **AI Smart Match** reads every open lost and found post and suggests likely pairs, even when the wording doesn't match |
| Text descriptions are vague | Posts can include a **photo** (up to 5 MB), a **category** and a **description** |
| Old posts clutter everything | Owners mark items **Resolved** once they're reunited, which moves them off the active board |
| Hard to find a specific item | **Full-text search** across item name, location, category, description and reporter, plus **category filters** |

## How it works

1. **Sign up with your college email.** Only `@karunya.edu.in` addresses are accepted. A 6-digit code is emailed to you (valid for 10 minutes) before the account is created.
2. **Set up your profile.** Add your full name and register number so other students know who they're talking to.
3. **Report an item.** Choose *I Lost Something* or *I Found Something*, then pick a category (Electronics, Documents, Keys, Clothing, Bags, Books, Accessories, Other) and add the location, a description, a photo and an optional phone number.
4. **Search, or let the AI match.** Browse the Lost and Found tabs, search, or press **✦ AI** to get suggested lost ↔ found pairs. Each suggestion has a confidence level (High / Medium / Low), the reasoning behind it, and one-click email links to both reporters.
5. **Connect and resolve.** Contact the reporter by email or phone. Once the item is back with its owner, mark the post as resolved.

### Who can do what

- **Students** can create posts, and can edit, resolve or delete their own.
- **The admin** (`admin@karunya.edu.in`) gets an extra **Admin** tab listing every post and can delete any of them.
- **Everyone** can open the **Analytics** panel, which shows active lost/found counts, resolved count, resolution rate, posts with photos, and a breakdown by category.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite |
| Auth | Firebase Authentication (email/password) |
| Database | Cloud Firestore (real-time listeners) |
| OTP email delivery | EmailJS |
| Image hosting | Cloudinary (unsigned upload preset) |
| AI matching | Anthropic Claude API |

## Project structure

```
KRecover/
└── campus-lost-found/
    ├── index.html
    ├── vite.config.js
    ├── package.json
    └── src/
        ├── main.jsx        # React entry point
        ├── App.jsx         # All views: landing, auth, OTP, profile, dashboard
        ├── App.css         # Dashboard and component styles
        ├── index.css       # Global styles
        └── firebase.js     # Firebase app, Auth and Firestore setup
```

### Firestore data model

- **`users/{uid}`**: `name`, `regNo`, `email`
- **`items/{id}`**: `type` (`Lost` | `Found`), `objectName`, `category`, `location`, `description`, `phone`, `photoUrl`, `reportedBy`, `reporterEmail`, `reporterUid`, `timestamp`, `resolved`, `resolvedAt`, `editedAt`

## Getting started

### Prerequisites

- Node.js 20+ and npm
- A Firebase project with **Email/Password** auth and **Firestore** enabled
- An EmailJS account with a service and an email template
- A Cloudinary account with an unsigned upload preset
- An Anthropic API key (only needed for AI matching)

### Install and run

```bash
git clone https://github.com/John-Paul2/KRecover.git
cd KRecover/campus-lost-found
npm install
npm run dev
```

### Configure your own services

Credentials are currently set directly in the source. To point the app at your own accounts, edit:

| What | Where |
|---|---|
| Firebase config | `src/firebase.js` → `firebaseConfig` |
| EmailJS service, template and public key | `src/App.jsx` → `EJS_SERVICE_ID`, `EJS_TEMPLATE_ID`, `EJS_PUBLIC_KEY` |
| Cloudinary cloud name and upload preset | `src/App.jsx` → `uploadPhoto()` |
| Admin account | `src/App.jsx` → `ADMIN_EMAIL` |
| Allowed email domain | `src/App.jsx` → `handleAuth()` (`@karunya.edu.in`) |

Your EmailJS template should use these variables: `{{to_email}}`, `{{to_name}}`, `{{otp_code}}`, `{{expiry_min}}`.

### Other scripts

```bash
npm run build     # production build to dist/
npm run preview   # serve the production build locally
npm run lint      # ESLint
```


No license has been specified yet. Add one (for example MIT) if you'd like others to reuse the code.
