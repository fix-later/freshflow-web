/* eslint-disable */
import { FuseNavigationItem } from '@fuse/components/navigation';

export const defaultNavigation: FuseNavigationItem[] = [
    {
        id: 'home',
        title: 'Home',
        type: 'basic',
        icon: 'heroicons_outline:home',
        link: '/home',
    },
    {
        id: 'shop',
        title: 'Shop',
        type: 'collapsable',
        icon: 'heroicons_outline:shopping-bag',
        children: [
            {
                id: 'shop-all',
                title: 'All Products',
                type: 'basic',
                link: '/shop',
            },
            {
                id: 'shop-vegetables',
                title: 'Vegetables',
                type: 'basic',
                link: '/shop',
            },
            {
                id: 'shop-fruits',
                title: 'Fresh Fruit',
                type: 'basic',
                link: '/shop',
            },
            {
                id: 'shop-meat',
                title: 'Meat & Seafood',
                type: 'basic',
                link: '/shop',
            },
        ],
    },
    {
        id: 'blog',
        title: 'Blog',
        type: 'basic',
        icon: 'heroicons_outline:newspaper',
        link: '/example',
    },
    {
        id: 'example',
        title: 'Example',
        type: 'basic',
        icon: 'heroicons_outline:chart-pie',
        link: '/example',
    },
];

export const compactNavigation: FuseNavigationItem[] = [
    {
        id: 'example',
        title: 'Example',
        type: 'basic',
        icon: 'heroicons_outline:chart-pie',
        link: '/example',
    },
];

export const futuristicNavigation: FuseNavigationItem[] = [
    {
        id: 'example',
        title: 'Example',
        type: 'basic',
        icon: 'heroicons_outline:chart-pie',
        link: '/example',
    },
];

export const horizontalNavigation: FuseNavigationItem[] = [
    {
        id: 'home',
        title: 'Home',
        type: 'collapsable',
        link: '/home',
        children: [
            {
                id: 'home-main',
                title: 'Homepage',
                type: 'basic',
                link: '/home',
            },
            {
                id: 'home-deals',
                title: 'Featured Deals',
                type: 'basic',
                link: '/home',
            },
            {
                id: 'home-bestsellers',
                title: 'Best Sellers',
                type: 'basic',
                link: '/home',
            },
            {
                id: 'home-new',
                title: 'New Arrivals',
                type: 'basic',
                link: '/home',
            },
        ],
    },
    {
        id: 'shop',
        title: 'Shop',
        type: 'collapsable',
        children: [
            {
                id: 'shop-all',
                title: 'All Products',
                type: 'basic',
                link: '/shop',
            },
            {
                id: 'shop-vegetables',
                title: 'Vegetables',
                type: 'basic',
                link: '/shop',
            },
            {
                id: 'shop-fruits',
                title: 'Fresh Fruit',
                type: 'basic',
                link: '/shop',
            },
            {
                id: 'shop-meat',
                title: 'Meat & Seafood',
                type: 'basic',
                link: '/shop',
            },
            {
                id: 'shop-bakery',
                title: 'Bakery',
                type: 'basic',
                link: '/shop',
            },
            {
                id: 'shop-drinks',
                title: 'Drinks',
                type: 'basic',
                link: '/shop',
            },
        ],
    },
    {
        id: 'blog',
        title: 'Blog',
        type: 'collapsable',
        link: '/example',
        children: [
            {
                id: 'blog-all',
                title: 'All Posts',
                type: 'basic',
                link: '/example',
            },
            {
                id: 'blog-recipes',
                title: 'Recipes',
                type: 'basic',
                link: '/example',
            },
            {
                id: 'blog-tips',
                title: 'Tips & Guides',
                type: 'basic',
                link: '/example',
            },
            { id: 'blog-news', title: 'News', type: 'basic', link: '/example' },
        ],
    },
    {
        id: 'pages',
        title: 'Pages',
        type: 'collapsable',
        children: [
            {
                id: 'pages-about',
                title: 'About Us',
                type: 'basic',
                link: '/home',
            },
            {
                id: 'pages-contact',
                title: 'Contact',
                type: 'basic',
                link: '/example',
            },
            { id: 'pages-faq', title: 'FAQ', type: 'basic', link: '/example' },
        ],
    },
];
