# 🌌 MAZI AI v2.05 (Multi-modal AI Zero Interface)

![MAZI AI Logo](file:///c:/10Project/08_RyuWork/10TypeScript/mazi-ai-v2-main/public/logo192.png)

MAZI AI v2 is a cutting-edge, real-time AI conversation platform powered by **Google Gemini**. It features two distinct interaction modes: **Standard Mode** for structured chat and **Live Mode** for immersive, low-latency voice-to-voice interaction.

## ✨ Key Features

- **🎙️ Live Conversational AI**: Instant voice-to-voice interaction using Gemini's Live Client (WebSockets/Bidi).
- **🎭 Multiple Personas**: Seamlessly switch between specialized roles like English Tutor, Cooking Assistant, Science Guru, and more.
- **🌈 Dynamic Visualizers**: High-fidelity audio visualizers (Bar, Line, Circle, Cloud, Fog) that react to AI speech and user input.
- **📚 Language Learning**: Dedicated personas for English and Japanese learning with level-specific prompts.
- **⚙️ Advanced Audio Control**: Real-time microphone threshold adjustment, noise suppression, and digital limiting.
- **💾 Session Management**: Auto-save chat history to local storage with export/import capabilities.

## 🚀 Quick Start

### 1. Prerequisites

- Node.js (v18+)
- NPM or Yarn
- Google AI Studio API Key ([Get one here](https://aistudio.google.com/))

### 2. Installation

```powershell
# Clone the repository
git clone https://github.com/basinfi10/uni10mazi.git

# Navigate to the directory
cd uni10mazi

# Install dependencies
npm install
```

### 3. Setup Environment Variables

Create a `.env` file in the root directory:

```env
VITE_GEMINI_API_KEY=your_gemini_api_key_here
```

### 4. Run Development Server

```powershell
npm run dev
```

## ☁️ Deployment (Vercel)

The project is optimized for deployment on **Vercel**.

1. Connect your GitHub repository to Vercel.
2. Configure the Environment Variable:
   - `VITE_GEMINI_API_KEY`: Your Gemini API Key.
3. Vercel will automatically detect the Vite configuration and deploy.

---

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Icons**: Lucide React
- **AI Engine**: Google Generative AI (Gemini 2.0 Flash)
- **Build Tool**: Vite 5
- **Deployment**: Vercel

---

*Developed by basinfi10. Optimized for high-performance AI interactions.*
