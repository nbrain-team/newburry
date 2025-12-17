# nBrain Landing Page - Deployment Instructions

This directory contains the landing page for nBrain's AI-first marketing automation platform.

## 📁 Files Included

- `index.html` - Complete landing page (fully self-contained)

## 🚀 Deployment

This landing page is **100% self-contained** and requires no additional files, frameworks, or dependencies.

### To Deploy:

1. **Upload to any web server**: Simply upload `index.html` to your web hosting
2. **Works anywhere**: Compatible with any static hosting service (Netlify, Vercel, GitHub Pages, S3, etc.)
3. **No build process needed**: No npm, no webpack, no compilation required

### Quick Deploy Options:

**Netlify**: Drag and drop this folder to netlify.com/drop

**Vercel**: Run `vercel` in this directory

**GitHub Pages**: Push to a repo and enable GitHub Pages

**Any hosting**: Upload via FTP/SFTP to your server's public directory

## ✨ Features

- All CSS embedded (no external stylesheets)
- All icons are Unicode emoji (no icon fonts or SVG files needed)
- Fully responsive design
- Works in all modern browsers
- No JavaScript dependencies

## 🎨 Customization

Edit `index.html` directly to:
- Change copy/messaging
- Update pricing
- Modify colors (see CSS variables in `:root`)
- Add/remove sections

## 🔗 Links to Update

Before going live, update these placeholder links in `index.html`:

- Hero CTA buttons (line ~348-349)
- Pricing buttons (line ~830-839)  
- Final CTA buttons (line ~870-871)

Replace `href="#"` with your actual URLs for:
- Demo scheduling
- Documentation
- Sales contact
- etc.

## 📱 Testing

Open `index.html` in any browser to preview. It will work perfectly without a server.

## 💡 Notes

The page uses the nBrain brand color (burgundy #bc4a4b) and follows your design system standards with Tailwind-like utility approaches and 8pt spacing system.

