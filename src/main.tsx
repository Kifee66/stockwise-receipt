

import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { toast } from '@/hooks/use-toast';


createRoot(document.getElementById("root")!).render(<App />);

// Register service worker for PWA/offline support and show update popup
if ('serviceWorker' in navigator) {
	window.addEventListener('load', () => {
		navigator.serviceWorker.register('/sw.js').then(reg => {
			// Listen for updates
			reg.addEventListener('updatefound', () => {
				const newWorker = reg.installing;
				if (newWorker) {
					newWorker.addEventListener('statechange', () => {
						if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
							toast({
								title: 'Update Available',
								description: 'A new version is available. Click to update.',
								action: (
									<button
										className="ml-2 px-2 py-1 rounded bg-primary text-primary-foreground"
										onClick={() => window.location.reload()}
									>
										Update
									</button>
								),
							});
						}
					});
				}
			});
		}).catch((err) => {
			console.warn('Service worker registration failed:', err);
		});
	});
}

// Show install PWA prompt
let deferredPrompt: BeforeInstallPromptEvent | null;

// Type for beforeinstallprompt event
interface BeforeInstallPromptEvent extends Event {
	prompt: () => Promise<void>;
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}
window.addEventListener('beforeinstallprompt', (e) => {
	e.preventDefault();
	deferredPrompt = e as BeforeInstallPromptEvent;
	toast({
		title: 'Install App',
		description: 'Install this app for a better experience.',
		action: (
			<button
				className="ml-2 px-2 py-1 rounded bg-primary text-primary-foreground"
				onClick={() => {
					if (deferredPrompt) {
						deferredPrompt.prompt();
						deferredPrompt.userChoice.then(() => {
							deferredPrompt = null;
						});
					}
				}}
			>
				Install
			</button>
		),
	});
});
