import React from 'react';
import { Helmet } from 'react-helmet-async';
import { SEOMetadata } from '../services/metadata';

interface SEOProps {
  metadata: SEOMetadata;
}

export const SEO: React.FC<SEOProps> = ({ metadata }) => {
  return (
    <Helmet>
      {/* Standard metadata */}
      <title>{metadata.title}</title>
      <meta name="description" content={metadata.description} />
      <link rel="canonical" href={metadata.canonical} />

      {/* Indexability rules */}
      {metadata.noindex ? (
        <meta name="robots" content="noindex" />
      ) : (
        <meta name="robots" content="index, follow" />
      )}

      {/* Open Graph metadata */}
      <meta property="og:title" content={metadata.ogTitle} />
      <meta property="og:description" content={metadata.ogDescription} />
      <meta property="og:image" content={metadata.ogImage} />
      <meta property="og:url" content={metadata.ogUrl} />
      <meta property="og:type" content={metadata.ogType} />
      <meta property="og:site_name" content={metadata.ogSiteName} />

      {/* Twitter Card metadata */}
      <meta name="twitter:card" content={metadata.twitterCard} />
      <meta name="twitter:title" content={metadata.twitterTitle} />
      <meta name="twitter:description" content={metadata.twitterDescription} />
      <meta name="twitter:image" content={metadata.twitterImage} />
    </Helmet>
  );
};
