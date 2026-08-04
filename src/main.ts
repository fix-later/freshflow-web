import { provideZoneChangeDetection } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { initSplashScreen } from '@fuse/services/splash-screen';
import { AppComponent } from 'app/app.component';
import { appConfig } from 'app/app.config';

// Hold the splash until Fuse signals the app is ready, then fade it out.
initSplashScreen();

bootstrapApplication(AppComponent, {
    ...appConfig,
    providers: [provideZoneChangeDetection(), ...appConfig.providers],
}).catch((err) => console.error(err));
