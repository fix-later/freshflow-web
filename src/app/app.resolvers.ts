import { inject } from '@angular/core';
import { ActivatedRouteSnapshot } from '@angular/router';
import { NavigationService } from 'app/core/navigation/navigation.service';
import { Area } from 'app/core/navigation/navigation.types';
import { MessagesService } from 'app/layout/common/messages/messages.service';
import { QuickChatService } from 'app/layout/common/quick-chat/quick-chat.service';
import { ShortcutsService } from 'app/layout/common/shortcuts/shortcuts.service';
import { forkJoin } from 'rxjs';

export const initialDataResolver = (route: ActivatedRouteSnapshot) => {
    const messagesService = inject(MessagesService);
    const navigationService = inject(NavigationService);
    const quickChatService = inject(QuickChatService);
    const shortcutsService = inject(ShortcutsService);

    // The nav reflects the route block's area (see `data.area` in app.routes.ts)
    const area = (route.data['area'] as Area | undefined) ?? 'storefront';

    // Notifications load lazily from the header trigger itself (real API call
    // that can fail independently — see NotificationsComponent), not blocking
    // route resolution here.
    // Fork join multiple API endpoint calls to wait all of them to finish
    return forkJoin([
        navigationService.get(area),
        messagesService.getAll(),
        quickChatService.getChats(),
        shortcutsService.getAll(),
    ]);
};
