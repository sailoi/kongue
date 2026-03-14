# Contributing to Kongue

Thank you for considering contributing to Kongue - Learn to speak, naturally! 🎉

## 🌟 Ways to Contribute

- 🌍 **Add New Languages** - Create lesson content for new languages
- 📝 **Improve Lessons** - Enhance existing lesson quality
- 🐛 **Report Bugs** - Help us identify issues
- ✨ **Suggest Features** - Share your ideas
- 🔧 **Fix Issues** - Submit bug fixes
- 📖 **Improve Documentation** - Make docs clearer
- 🎨 **Enhance UI/UX** - Improve the design

## 🚀 Getting Started

### 1. Fork and Clone

```bash
# Fork the repo on GitHub, then clone your fork
git clone https://github.com/sailoi/kongue.git
cd kongue

# Add upstream remote
git remote add upstream https://github.com/sailoi/kongue.git
```

### 2. Set Up Development Environment

```bash
# Install dependencies
npm install

# Copy environment files
cp .env.example .env

# Start the development server
npx expo start
```

### 3. Create a Branch

```bash
# Create a feature branch
git checkout -b feature/amazing-feature

# Or a bug fix branch
git checkout -b fix/bug-description
```

### 4. Make Your Changes

- Write clean, readable code
- Follow existing code style
- Add comments for complex logic
- Test your changes thoroughly

### 5. Commit Your Changes

```bash
# Stage your changes
git add .

# Commit with a clear message
git commit -m "Add: Brief description of what you added"
```

**Commit Message Format:**
- `Add: New feature description`
- `Fix: Bug fix description`
- `Update: Change description`
- `Docs: Documentation update`
- `Style: Code style/formatting change`
- `Refactor: Code refactoring`

### 6. Push and Create Pull Request

```bash
# Push to your fork
git push origin feature/amazing-feature

# Then create a Pull Request on GitHub
```

## 📚 Adding New Language Content

### Structure

Lessons are stored in `assets/categories/{language}/{category}.json`

Example structure:
```json
[
  {
    "title": "Lesson 1:\nGreetings",
    "description": "Learn basic greetings in [Language]",
    "dialogue": [
      {
        "speaker": "A",
        "gender": "female",
        "turkish": "Merhaba",
        "english": "Hello"
      },
      {
        "speaker": "B",
        "gender": "male",
        "turkish": "Merhaba, nasılsın?",
        "english": "Hello, how are you?"
      }
    ]
  }
]
```

### Adding a New Language

1. Create folder: `assets/categories/{language_code}/`
2. Create 7 category files:
   - `greetings_and_courtesies.json`
   - `personal_information.json`
   - `numbers_and_time.json`
   - `food_and_dining.json`
   - `travel_and_directions.json`
   - `shopping.json`
   - `daily_life.json`

3. Add language config to `constants/languages.ts`:
```typescript
{
  id: 'your_language',
  name: 'Your Language',
  flag: '🇫🇷',
  targetLanguage: 'Your Language',
  baseLanguage: 'English',
  voiceGender: {
    male: 'your-TTS-voice-code',
    female: 'your-TTS-voice-code',
  },
}
```

4. Update `constants/conversations.ts` to import your files

## 🐛 Reporting Bugs

**Before submitting:**
- Check if the bug has already been reported
- Collect information about your environment

**Include in your report:**
- Clear description of the bug
- Steps to reproduce
- Expected vs actual behavior
- Screenshots (if applicable)
- Device/OS information
- App version

**Use this template:**
```markdown
**Describe the bug**
A clear description of what the bug is.

**To Reproduce**
1. Go to '...'
2. Click on '...'
3. See error

**Expected behavior**
What should happen.

**Screenshots**
If applicable, add screenshots.

**Environment:**
- OS: [e.g. iOS 17, Android 14]
- Device: [e.g. iPhone 15, Samsung Galaxy S24]
- App Version: [e.g. 1.0.0]
```

## ✨ Suggesting Features

We love new ideas! When suggesting a feature:

1. **Check existing issues** - Might already be planned
2. **Describe the problem** - What user need does this address?
3. **Propose a solution** - How would this feature work?
4. **Consider alternatives** - Are there other ways to solve this?
5. **Additional context** - Mockups, examples, etc.

## 📋 Code Style Guidelines

### TypeScript/JavaScript
- Use TypeScript for type safety
- Use functional components with hooks
- Prefer `const` over `let`
- Use meaningful variable names
- Add JSDoc comments for complex functions

```typescript
// ✅ Good
const fetchLessons = async (language: string): Promise<Lesson[]> => {
  // Implementation
}

// ❌ Avoid
function doStuff(x) {
  // Implementation
}
```

### Python (Backend)
- Follow PEP 8 style guide
- Use type hints
- Document functions with docstrings

```python
# ✅ Good
def generate_audio(text: str, language: str) -> bytes:
    """
    Generate audio from text using TTS.
    
    Args:
        text: The text to convert
        language: Language code (e.g., 'es-ES')
    
    Returns:
        Audio bytes in MP3 format
    """
    # Implementation
```

### File Naming
- Components: `PascalCase.tsx` (e.g., `SettingsModal.tsx`)
- Utilities: `camelCase.ts` (e.g., `formatDate.ts`)
- Constants: `camelCase.ts` (e.g., `apiConfig.ts`)

## 🧪 Testing

Before submitting:
- ✅ Test on both iOS and Android (if possible)
- ✅ Test in both light and dark mode
- ✅ Check for console errors/warnings
- ✅ Verify no broken functionality
- ✅ Test edge cases

## 📝 Documentation

When adding features:
- Update README.md if needed
- Add JSDoc/docstring comments
- Update relevant .md files
- Include code examples

## 🔍 Review Process

After submitting a PR:
1. **Automated checks** run (linting, tests)
2. **Code review** by maintainers
3. **Feedback** - Address requested changes
4. **Approval** - Once approved, we'll merge!

**Be patient** - Reviews may take a few days.

## 🎯 PR Best Practices

- ✅ Keep PRs focused on one feature/fix
- ✅ Write clear PR descriptions
- ✅ Link related issues
- ✅ Update documentation
- ✅ Respond to feedback promptly
- ❌ Don't include unrelated changes
- ❌ Don't force-push after review (unless asked)

## 💬 Communication

- Be respectful and constructive
- Ask questions if unclear
- Provide context in discussions
- Help other contributors

## 📜 License

By contributing, you agree that your contributions will be licensed under the GPL-3.0 License.

## 🙏 Thank You!

Every contribution, no matter how small, helps make this project better. We appreciate your time and effort! ❤️

---

**Questions?** Open an issue or start a discussion!
