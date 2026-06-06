import {
    ChangeDetectionStrategy,
    Component,
    OnDestroy,
    OnInit,
    ViewChild,
    ViewEncapsulation,
} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FuseLoadingBarComponent } from '@fuse/components/loading-bar';
import {
    FuseNavigationService,
    FuseVerticalNavigationComponent,
} from '@fuse/components/navigation';
import { FuseMediaWatcherService } from '@fuse/services/media-watcher';
import { NavigationService } from 'app/core/navigation/navigation.service';
import { Navigation } from 'app/core/navigation/navigation.types';
import { SearchComponent } from 'app/layout/common/search/search.component';
import { Subject, takeUntil } from 'rxjs';
import { EnterpriseAiChatComponent } from './enterprise-ai-chat/enterprise-ai-chat.component';
import { EnterpriseHeaderComponent } from './enterprise-header/enterprise-header.component';

@Component({
    selector: 'enterprise-layout',
    templateUrl: './enterprise.component.html',
    styleUrls: ['./enterprise.component.scss'],
    encapsulation: ViewEncapsulation.None,
    standalone: true,
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [
        FuseLoadingBarComponent,
        FuseVerticalNavigationComponent,
        EnterpriseHeaderComponent,
        SearchComponent,
        EnterpriseAiChatComponent,
        RouterOutlet,
    ],
})
export class EnterpriseLayoutComponent implements OnInit, OnDestroy {
    @ViewChild('headerSearch') headerSearch: SearchComponent;
    @ViewChild('headerAiChat') headerAiChat: EnterpriseAiChatComponent;

    isScreenSmall: boolean;
    navigation: Navigation;
    private _unsubscribeAll: Subject<any> = new Subject<any>();

    constructor(
        private _navigationService: NavigationService,
        private _fuseMediaWatcherService: FuseMediaWatcherService,
        private _fuseNavigationService: FuseNavigationService
    ) {}

    get currentYear(): number {
        return new Date().getFullYear();
    }

    ngOnInit(): void {
        this._navigationService.navigation$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe((navigation: Navigation) => {
                this.navigation = navigation;
            });

        this._fuseMediaWatcherService.onMediaChange$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(({ matchingAliases }) => {
                this.isScreenSmall = !matchingAliases.includes('md');
            });
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }

    toggleNavigation(name: string): void {
        const navigation =
            this._fuseNavigationService.getComponent<FuseVerticalNavigationComponent>(
                name
            );

        if (navigation) {
            navigation.toggle();
        }
    }

    openSearch(): void {
        this.headerSearch?.open();
    }

    openAiChat(): void {
        this.headerAiChat?.open();
    }
}
