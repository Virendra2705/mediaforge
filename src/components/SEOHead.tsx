import React, { useEffect } from 'react';

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface SEOHeadProps {
  title: string;
  description: string;
  canonicalPath?: string;
  ogType?: 'website' | 'article';
  ogImage?: string;
  noindex?: boolean;
  breadcrumbs?: BreadcrumbItem[];
  faqs?: FaqItem[];
  article?: {
    publishedTime?: string;
    author?: string;
    section?: string;
  };
}

export const SEOHead: React.FC<SEOHeadProps> = ({
  title,
  description,
  canonicalPath = '',
  ogType = 'website',
  ogImage = '/og-image.svg',
  noindex = false,
  breadcrumbs,
  faqs,
  article,
}) => {
  useEffect(() => {
    // 1. Update Document Title
    const brandSuffix = title.includes('VideoFetch') ? '' : ' | VideoFetch';
    document.title = `${title}${brandSuffix}`;

    // 2. Helper to set or update meta tag by name or property
    const setMetaTag = (attribute: 'name' | 'property', key: string, content: string) => {
      let element = document.querySelector(`meta[${attribute}="${key}"]`) as HTMLMetaElement | null;
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attribute, key);
        document.head.appendChild(element);
      }
      element.content = content;
    };

    // 3. Update Standard Meta Description
    setMetaTag('name', 'description', description);

    // 4. Update Canonical Tag
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://videofetch.app';
    const cleanPath = canonicalPath.startsWith('/') ? canonicalPath : `/${canonicalPath}`;
    const fullCanonicalUrl = `${origin}${cleanPath === '/' ? '' : cleanPath}`;

    let canonicalLink = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.rel = 'canonical';
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.href = fullCanonicalUrl;

    // 5. Update Robots (Noindex for 404 / Admin, index,follow for normal pages)
    if (noindex) {
      setMetaTag('name', 'robots', 'noindex, nofollow');
    } else {
      setMetaTag('name', 'robots', 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1');
    }

    // 6. Update OpenGraph Tags
    setMetaTag('property', 'og:site_name', 'VideoFetch');
    setMetaTag('property', 'og:type', ogType);
    setMetaTag('property', 'og:title', `${title}${brandSuffix}`);
    setMetaTag('property', 'og:description', description);
    setMetaTag('property', 'og:url', fullCanonicalUrl);
    setMetaTag('property', 'og:image', ogImage.startsWith('http') ? ogImage : `${origin}${ogImage}`);

    // 7. Update Twitter Card Tags
    setMetaTag('name', 'twitter:card', 'summary_large_image');
    setMetaTag('name', 'twitter:site', '@videofetch');
    setMetaTag('name', 'twitter:title', `${title}${brandSuffix}`);
    setMetaTag('name', 'twitter:description', description);
    setMetaTag('name', 'twitter:image', ogImage.startsWith('http') ? ogImage : `${origin}${ogImage}`);

    // 8. Inject Dynamic Schema.org JSON-LD
    const jsonLdId = 'videofetch-dynamic-jsonld';
    let scriptElement = document.getElementById(jsonLdId) as HTMLScriptElement | null;
    if (!scriptElement) {
      scriptElement = document.createElement('script');
      scriptElement.id = jsonLdId;
      scriptElement.type = 'application/ld+json';
      document.head.appendChild(scriptElement);
    }

    const graph: any[] = [
      {
        '@type': 'WebPage',
        '@id': `${fullCanonicalUrl}#webpage`,
        url: fullCanonicalUrl,
        name: title,
        description,
        isPartOf: {
          '@type': 'WebSite',
          '@id': `${origin}/#website`,
          name: 'VideoFetch',
          url: origin,
        },
      },
    ];

    // Add BreadcrumbList Schema if provided
    if (breadcrumbs && breadcrumbs.length > 0) {
      graph.push({
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbs.map((b, idx) => ({
          '@type': 'ListItem',
          position: idx + 1,
          name: b.name,
          item: b.url.startsWith('http') ? b.url : `${origin}${b.url}`,
        })),
      });
    }

    // Add FAQPage Schema if provided
    if (faqs && faqs.length > 0) {
      graph.push({
        '@type': 'FAQPage',
        mainEntity: faqs.map((f) => ({
          '@type': 'Question',
          name: f.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: f.answer,
          },
        })),
      });
    }

    // Add Article Schema if article info provided
    if (article) {
      graph.push({
        '@type': 'Article',
        headline: title,
        description,
        datePublished: article.publishedTime,
        author: {
          '@type': 'Organization',
          name: article.author || 'VideoFetch Editorial',
        },
        publisher: {
          '@type': 'Organization',
          name: 'VideoFetch',
          logo: {
            '@type': 'ImageObject',
            url: `${origin}/favicon.svg`,
          },
        },
      });
    }

    scriptElement.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': graph,
    });
  }, [title, description, canonicalPath, ogType, ogImage, noindex, breadcrumbs, faqs, article]);

  return null;
};
