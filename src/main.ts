import { provideZoneChangeDetection } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { initSplashScreen } from '@fuse/services/splash-screen';
import { AppComponent } from 'app/app.component';
import { appConfig } from 'app/app.config';

// Start the cinematic splash before Angular boots; it exits on its own
// once the intro has played and Fuse signals the app is ready.
initSplashScreen();

bootstrapApplication(AppComponent, {
    ...appConfig,
    providers: [provideZoneChangeDetection(), ...appConfig.providers],
}).catch((err) => console.error(err));
