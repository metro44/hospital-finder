'use client';

import '@ant-design/v5-patch-for-react-19';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { APIProvider } from '@vis.gl/react-google-maps';
import { App as AntdApp, ConfigProvider, theme as antdTheme } from 'antd';
import { useState } from 'react';

export const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

const FONT_STACK =
  "var(--font-inter), -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const themeConfig = {
  cssVar: true,
  algorithm: antdTheme.defaultAlgorithm,
  token: {
    colorPrimary: '#2563eb',
    colorInfo: '#2563eb',
    colorLink: '#2563eb',
    borderRadius: 10,
    borderRadiusLG: 14,
    borderRadiusSM: 8,
    fontFamily: FONT_STACK,
    fontSize: 14,
    colorBgLayout: '#f3f5f9',
    colorText: '#0f172a',
    colorTextSecondary: '#475569',
    colorTextTertiary: '#64748b',
    colorBorder: 'rgba(15, 23, 42, 0.10)',
    colorBorderSecondary: 'rgba(15, 23, 42, 0.06)',
    controlHeight: 38,
    controlHeightLG: 44,
    boxShadow: '0 1px 2px rgba(15,23,42,0.05), 0 12px 32px -16px rgba(15,23,42,0.18)',
    boxShadowSecondary: '0 1px 2px rgba(15,23,42,0.04), 0 10px 28px -14px rgba(15,23,42,0.14)',
    wireframe: false,
  },
  components: {
    Button: { fontWeight: 500, primaryShadow: 'none', defaultShadow: 'none' },
    Card: { paddingLG: 20 },
    Segmented: { trackBg: '#e9edf4', itemSelectedBg: '#ffffff', trackPadding: 3 },
    Tag: { defaultBg: '#eef2f7', defaultColor: '#334155' },
    Drawer: { paddingLG: 22 },
    Timeline: { dotBorderWidth: 2 },
  },
} as const;

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 60 * 6,
            gcTime: 1000 * 60 * 60 * 12,
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
            retry: 1,
          },
        },
      }),
  );

  return (
    <ConfigProvider theme={themeConfig}>
      <AntdApp
        className="contents"
        message={{ maxCount: 3, duration: 2 }}
        notification={{ placement: 'bottomRight' }}
      >
        <QueryClientProvider client={queryClient}>
          <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>{children}</APIProvider>
          <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
      </AntdApp>
    </ConfigProvider>
  );
}
