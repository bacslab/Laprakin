import React from 'react';
import {
  Body,
  Button,
  Container,
  Font,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from 'react-email';
import { capitalizeInitial, safeAbsoluteUrl } from '../text.js';

const h = React.createElement;

export const EMAIL_COLORS = {
  page: '#F5F7FA',
  card: '#FFFFFF',
  border: '#E5E7EB',
  text: '#111827',
  muted: '#6B7280',
  accent: '#B8FF2C',
  accentText: '#111827',
  success: '#16A34A',
  danger: '#DC2626',
  warning: '#D97706',
  neutral: '#6B7280',
};

const fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
const headingFontFamily = '"Plus Jakarta Sans", Arial, sans-serif';
export const EMAIL_LOGO_URL = 'https://laprakin.app/brand/laprakin-email-logo.png?v=1';

/** @type {Record<string, React.CSSProperties>} */
const styles = {
  body: {
    backgroundColor: EMAIL_COLORS.page,
    color: EMAIL_COLORS.text,
    fontFamily,
    margin: 0,
    padding: '24px 12px',
    width: '100%',
  },
  card: {
    backgroundColor: EMAIL_COLORS.card,
    border: `1px solid ${EMAIL_COLORS.border}`,
    borderRadius: '12px',
    boxSizing: 'border-box',
    margin: '0 auto',
    maxWidth: '600px',
    width: '100%',
  },
  wordmark: {
    color: EMAIL_COLORS.text,
    fontFamily: headingFontFamily,
    fontSize: '18px',
    fontWeight: 700,
    lineHeight: '24px',
    margin: 0,
  },
  status: {
    color: EMAIL_COLORS.muted,
    fontSize: '11px',
    fontWeight: 700,
    lineHeight: '16px',
    margin: '0 0 12px',
    textTransform: 'uppercase',
  },
  heading: {
    color: EMAIL_COLORS.text,
    fontFamily: headingFontFamily,
    fontSize: '23px',
    fontWeight: 700,
    lineHeight: '30px',
    margin: '0 0 10px',
  },
  supporting: {
    color: EMAIL_COLORS.muted,
    fontSize: '14px',
    lineHeight: '21px',
    margin: '0 0 24px',
  },
  content: {
    color: EMAIL_COLORS.text,
    fontSize: '14px',
    lineHeight: '21px',
  },
  hr: {
    borderColor: EMAIL_COLORS.border,
    borderTop: 0,
    margin: '28px 0 20px',
  },
  footer: {
    color: EMAIL_COLORS.muted,
    fontSize: '12px',
    lineHeight: '18px',
    margin: 0,
  },
};

/**
 * @typedef {'success'|'danger'|'warning'|'neutral'} EmailTone
 * @typedef {{label: string, href: string}} EmailCta
 * @typedef {{
 *   preview: string,
 *   statusLabel: string,
 *   statusTone?: EmailTone,
 *   heading: string,
 *   supportingText?: string,
 *   cta?: EmailCta | null,
 *   children?: React.ReactNode
 * }} EmailLayoutProps
 */

/** @param {EmailLayoutProps} props */
export function EmailLayout({
  preview,
  statusLabel,
  statusTone = 'neutral',
  heading,
  supportingText = '',
  cta = null,
  children = null,
}) {
  const ctaUrl = safeAbsoluteUrl(cta?.href);
  const statusColor = EMAIL_COLORS[statusTone] || EMAIL_COLORS.neutral;

  return h(
    Html,
    { lang: 'id' },
    h(
      Head,
      null,
      h('meta', { name: 'viewport', content: 'width=device-width, initial-scale=1.0' }),
      h(Font, {
        fontFamily: 'Plus Jakarta Sans',
        fallbackFontFamily: 'Arial',
        fontStyle: 'normal',
        fontWeight: 700,
        webFont: {
          format: 'woff2',
          url: 'https://fonts.gstatic.com/s/plusjakartasans/v12/LDIoaomQNQcsA88c7O9yZ4KMCoOg4Ko20yw.woff2',
        },
      }),
      h(
        'style',
        null,
        '@media only screen and (max-width: 620px) { .laprakin-email-content { padding: 20px !important; } .laprakin-detail-label, .laprakin-detail-value { display: block !important; width: 100% !important; } .laprakin-detail-value { padding-top: 2px !important; text-align: left !important; } }',
      ),
    ),
    h(Preview, null, preview),
    h(
      Body,
      { style: styles.body },
      h(
        Container,
        { className: 'laprakin-email-card', style: styles.card },
        h(
          'div',
          { className: 'laprakin-email-content', style: { padding: '32px' } },
          h(
            'table',
            {
              cellPadding: '0',
              cellSpacing: '0',
              role: 'presentation',
              style: { margin: '0 0 28px', width: 'auto' },
            },
            h(
              'tbody',
              null,
              h(
                'tr',
                null,
                h(
                  'td',
                  { style: { padding: '0 10px 0 0', verticalAlign: 'middle' } },
                  h(Img, {
                    alt: 'Logo Laprakin',
                    height: '36',
                    src: EMAIL_LOGO_URL,
                    style: { display: 'block', height: '36px', width: '36px' },
                    width: '36',
                  }),
                ),
                h(
                  'td',
                  { style: { verticalAlign: 'middle' } },
                  h(Text, { style: styles.wordmark }, 'Laprakin'),
                ),
              ),
            ),
          ),
          h(
            Text,
            { style: styles.status },
            h('span', {
              'aria-hidden': 'true',
              style: {
                backgroundColor: statusColor,
                borderRadius: '999px',
                display: 'inline-block',
                height: '8px',
                marginRight: '8px',
                verticalAlign: '1px',
                width: '8px',
              },
            }),
            statusLabel,
          ),
          h(Heading, { as: 'h1', style: styles.heading }, capitalizeInitial(heading)),
          supportingText ? h(Text, { style: styles.supporting }, supportingText) : null,
          h(Section, { style: styles.content }, children),
          ctaUrl && cta?.label
            ? h(
              Section,
              { style: { marginTop: '26px' } },
              h(Button, {
                href: ctaUrl,
                style: {
                  backgroundColor: EMAIL_COLORS.accent,
                  borderRadius: '8px',
                  color: EMAIL_COLORS.accentText,
                  display: 'inline-block',
                  fontSize: '14px',
                  fontWeight: 700,
                  lineHeight: '20px',
                  padding: '12px 18px',
                  textDecoration: 'none',
                },
              }, cta.label),
            )
            : null,
          h(Hr, { style: styles.hr }),
          h(
            Text,
            { style: styles.footer },
            'Email otomatis dari Laprakin. Tidak perlu membalas email ini.',
            h('br'),
            h(Link, {
              href: 'https://laprakin.app',
              style: { color: EMAIL_COLORS.muted, textDecoration: 'underline' },
            }, 'laprakin.app'),
          ),
        ),
      ),
    ),
  );
}

/**
 * @typedef {{label: string, value: string, mono?: boolean}} EmailDetail
 * @param {{items: EmailDetail[]}} props
 */
export function EmailDetailTable({ items }) {
  const rows = items.filter((item) => String(item?.value || '').trim());
  if (!rows.length) return null;

  return h(
    Section,
    {
      style: {
        borderTop: `1px solid ${EMAIL_COLORS.border}`,
        marginTop: '4px',
      },
    },
    h(
      'table',
      { cellPadding: '0', cellSpacing: '0', role: 'presentation', style: { width: '100%' } },
      h(
        'tbody',
        null,
        ...rows.map((item) => h(
          'tr',
          { key: item.label },
          h(
            'td',
            {
              className: 'laprakin-detail-label',
              style: {
                borderBottom: `1px solid ${EMAIL_COLORS.border}`,
                color: EMAIL_COLORS.muted,
                fontSize: '13px',
                lineHeight: '20px',
                padding: '12px 12px 12px 0',
                verticalAlign: 'top',
                width: '36%',
              },
            },
            item.label,
          ),
          h(
            'td',
            {
              className: 'laprakin-detail-value',
              style: {
                borderBottom: `1px solid ${EMAIL_COLORS.border}`,
                color: EMAIL_COLORS.text,
                fontFamily: item.mono ? '"SFMono-Regular", Consolas, "Liberation Mono", monospace' : fontFamily,
                fontSize: '13px',
                lineHeight: '20px',
                overflowWrap: 'anywhere',
                padding: '12px 0',
                textAlign: 'right',
                verticalAlign: 'top',
                width: '64%',
              },
            },
            item.value,
          ),
        )),
      ),
    ),
  );
}

/** @param {{children: React.ReactNode}} props */
export function EmailParagraph({ children }) {
  return h(Text, {
    style: {
      color: EMAIL_COLORS.text,
      fontSize: '14px',
      lineHeight: '21px',
      margin: '0 0 14px',
    },
  }, children);
}
