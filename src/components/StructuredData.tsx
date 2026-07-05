import React from 'react';
import { Helmet } from 'react-helmet-async';

interface StructuredDataProps {
  schema: Record<string, any> | null;
}

export const StructuredData: React.FC<StructuredDataProps> = ({ schema }) => {
  if (!schema) return null;

  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(schema)}
      </script>
    </Helmet>
  );
};
