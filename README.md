# Royaltē — Music Royalty Intelligence
### By Se7ven Labs

A futuristic marketing website for Royaltē, the AI-powered music royalty tracking platform.

---

## 🚀 Deploy to Vercel in 3 steps

### Option A — Vercel CLI (fastest)

```bash
# 1. Install Vercel CLI
npm install -g vercel

# 2. Inside this folder, run:
vercel

# 3. Follow the prompts:
#    - Link to existing project? → N
#    - Project name → royalte (or your choice)
#    - Which directory is your code? → ./
#    - Want to override settings? → N

# Your site will be live at: https://royalte.vercel.app
```

### Option B — GitHub + Vercel Dashboard (recommended for ongoing updates)

```bash
# 1. Create a new GitHub repo at github.com/new
#    Name it: royalte-site

# 2. Push this folder to GitHub:
git init
git add .
git commit -m "Initial launch — Royaltē website"
git remote add origin https://github.com/YOUR_USERNAME/royalte-site.git
git push -u origin main

# 3. Go to vercel.com/new
#    → Import your GitHub repo
#    → Framework: Other
#    → Root directory: ./
#    → Build command: (leave blank)
#    → Output directory: public
#    → Click Deploy
```

---

## 📁 Project structure

```
royalte-site/
├── public/
│   ├── index.html          ← Main website (Royaltē v4)
│   └── se7ven_labs_popped.png  ← Se7ven Labs logo
├── vercel.json             ← Vercel routing config
├── package.json
├── .gitignore
└── README.md
```

---

## 🌐 Custom domain

Once deployed on Vercel:
1. Go to your project → Settings → Domains
2. Add `royalte.io` (or whatever domain you own)
3. Update your DNS records as instructed by Vercel
4. SSL is automatic — free via Vercel

Recommended domains to register:
- `royalte.io`
- `royalte.music`
- `getroyalte.com`

---

## ✏️ Making updates

All site content lives in `public/index.html`. 

Key sections to personalise before launch:
- **Line ~nav**: Replace nav links with real anchor targets
- **Waitlist CTA buttons**: Wire up to a form (Typeform, Tally, or Mailchimp)
- **Pricing buttons**: Connect to Stripe checkout links
- **Testimonials**: Replace placeholder names with real beta users
- **Stats**: Update `11M+`, `$1.2B` etc. as needed

---

## 📧 Capture waitlist emails (free)

Before you have a real product, capture interest with a free tool:

**Tally.so** (recommended — free, beautiful forms):
1. Go to tally.so → create a form with just an email field
2. Get your form URL e.g. `https://tally.so/r/XXXXX`
3. Replace all `href="#pricing"` CTA buttons with your Tally link

**Or Mailchimp**:
1. Create a free Mailchimp account
2. Create a landing page / embedded form
3. Replace CTA buttons with your signup link

---

## 🔧 Tech stack

- Pure HTML/CSS/JS — zero dependencies, zero build step
- Fonts: Rajdhani, Space Mono, Space Grotesk (Google Fonts CDN)
- Images: Unsplash CDN (free, no attribution required for commercial use)
- Hosting: Vercel (free tier covers this site easily)

---

*Built with Se7ven Labs AI · Powered by Claude*

