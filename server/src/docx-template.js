import path from 'node:path';
import { fileURLToPath } from 'node:url';
import AdmZip from 'adm-zip';

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
export const defaultLaprakTemplatePath = path.resolve(moduleDirectory, '../assets/templates/default-laprak.docx');

const BODY_OPEN = /<w:body\b[^>]*>/i;
const BODY_CLOSE = /<\/w:body>/i;
const RELATIONSHIP_TAG = /<Relationship\b[^>]*\/>/gi;
const TEXT_NODE = /(<w:t\b[^>]*>)([\s\S]*?)(<\/w:t>)/gi;
const BREAK_NODE = /<w:br\b[^>]*\/>/gi;

function xmlEscape(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function xmlUnescape(value = '') {
  return String(value)
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&amp;', '&');
}

function documentBodyParts(xml) {
  const open = BODY_OPEN.exec(xml);
  const close = BODY_CLOSE.exec(xml);
  if (!open || !close || close.index <= open.index) throw new Error('Struktur word/document.xml tidak valid.');
  const contentStart = open.index + open[0].length;
  return {
    prefix: xml.slice(0, contentStart),
    body: xml.slice(contentStart, close.index),
    suffix: xml.slice(close.index),
  };
}

function splitTopLevelElements(bodyXml) {
  const elements = [];
  const tagPattern = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<\/?([A-Za-z_][\w:.-]*)(?:\s[^<>]*?)?\/?>/g;
  let cursor = 0;
  while (cursor < bodyXml.length) {
    while (cursor < bodyXml.length && /\s/.test(bodyXml[cursor])) cursor += 1;
    if (cursor >= bodyXml.length) break;
    tagPattern.lastIndex = cursor;
    const first = tagPattern.exec(bodyXml);
    if (!first || first.index !== cursor) throw new Error('Elemen body DOCX tidak dapat dipetakan.');
    const firstText = first[0];
    if (firstText.startsWith('<?') || firstText.startsWith('<!--') || firstText.endsWith('/>')) {
      elements.push(firstText);
      cursor = tagPattern.lastIndex;
      continue;
    }
    const rootName = first[1];
    let depth = firstText.startsWith('</') ? 0 : 1;
    while (depth > 0) {
      const next = tagPattern.exec(bodyXml);
      if (!next) throw new Error(`Elemen ${rootName} tidak ditutup.`);
      const token = next[0];
      if (token.startsWith('<?') || token.startsWith('<!--') || token.endsWith('/>')) continue;
      if (next[1] === rootName) depth += token.startsWith('</') ? -1 : 1;
    }
    elements.push(bodyXml.slice(cursor, tagPattern.lastIndex));
    cursor = tagPattern.lastIndex;
  }
  return elements;
}

function elementText(xml = '') {
  return [...String(xml).matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/gi)]
    .map((match) => xmlUnescape(match[1]))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

function paragraphLines(xml = '') {
  return String(xml).split(BREAK_NODE).map(elementText);
}

function replaceTextInSegment(segment, value) {
  let replaced = false;
  return segment.replace(TEXT_NODE, (match, open, _content, close) => {
    if (replaced) return `${open}${close}`;
    replaced = true;
    return `${open}${xmlEscape(value)}${close}`;
  });
}

function replaceParagraphLines(xml, lines) {
  const segments = String(xml).split(BREAK_NODE);
  const breaks = String(xml).match(BREAK_NODE) || [];
  return segments.map((segment, index) => {
    const updated = replaceTextInSegment(segment, lines[index] || '');
    return index < breaks.length ? `${updated}${breaks[index]}` : updated;
  }).join('');
}

function isCenteredParagraph(xml) {
  return /<w:jc\b[^>]*w:val="center"/i.test(xml);
}

function detectCoverBoundary(elements) {
  const explicit = elements.findIndex((element, index) => index >= 4 && /<w:pageBreakBefore\b/i.test(element));
  if (explicit >= 0) return explicit;

  const bodyHeading = elements.findIndex((element, index) => {
    if (index < 8 || isCenteredParagraph(element)) return false;
    const text = elementText(element);
    return /^(?:bab\s+[ivxlcdm\d]+|langkah\b|praktikum\b|\d+[.)]\s+\S+)/i.test(text);
  });
  if (bodyHeading >= 0) return bodyHeading;

  const firstBodyParagraph = elements.findIndex((element, index) => {
    if (index < 8 || isCenteredParagraph(element)) return false;
    const text = elementText(element);
    return text.length >= 4;
  });
  return firstBodyParagraph >= 0 ? firstBodyParagraph : Math.min(18, Math.max(1, elements.length - 1));
}

function nextTextIndex(elements, start, end = elements.length) {
  for (let index = start; index < end; index += 1) {
    if (elementText(elements[index])) return index;
  }
  return -1;
}

function patchAcademicLine(line, slots) {
  let result = String(line || '');
  if (slots.studyProgram) {
    result = result.replace(
      /(PROGRAM\s+STUDI\s+)(.*?)(?=\s+(?:JURUSAN|FAKULTAS|POLITEKNIK|UNIVERSITAS|INSTITUT|AKADEMI)\b)/i,
      `$1${slots.studyProgram}`,
    );
  }
  if (slots.department) {
    result = result.replace(
      /((?:JURUSAN|FAKULTAS)\s+)(.*?)(?=\s+(?:POLITEKNIK|UNIVERSITAS|INSTITUT|AKADEMI)\b)/i,
      `$1${slots.department.replace(/^(?:JURUSAN|FAKULTAS)\s+/i, '')}`,
    );
  }
  if (slots.academicYear) result = result.replace(/\b20\d{2}\s*\/\s*20\d{2}\b/, slots.academicYear);
  return result;
}

function patchCoverElements(elements, slots) {
  const patched = [...elements];
  const titleIndex = patched.findIndex((element) => /\bLAPORAN\s+PRAKTIKUM\b/i.test(elementText(element)));
  const lecturerLabelIndex = patched.findIndex((element) => /\bDOSEN\s+PENGAMPU\b/i.test(elementText(element)));
  const authorLabelIndex = patched.findIndex((element) => /\bDISUSUN\s+OLEH\b/i.test(elementText(element)));
  const academicIndex = patched.findIndex((element) => /\bPROGRAM\s+STUDI\b|\bTAHUN\s+AKADEMIK\b/i.test(elementText(element)));

  const courseIndex = titleIndex >= 0 ? nextTextIndex(patched, titleIndex + 1, lecturerLabelIndex >= 0 ? lecturerLabelIndex : patched.length) : -1;
  const moduleIndex = courseIndex >= 0 ? nextTextIndex(patched, courseIndex + 1, lecturerLabelIndex >= 0 ? lecturerLabelIndex : patched.length) : -1;
  if (courseIndex >= 0 && slots.courseName) patched[courseIndex] = replaceParagraphLines(patched[courseIndex], [slots.courseName.toUpperCase()]);
  if (moduleIndex >= 0 && slots.moduleTitle) patched[moduleIndex] = replaceParagraphLines(patched[moduleIndex], [slots.moduleTitle]);

  const lecturerIndex = lecturerLabelIndex >= 0 ? nextTextIndex(patched, lecturerLabelIndex + 1, authorLabelIndex >= 0 ? authorLabelIndex : patched.length) : -1;
  if (lecturerIndex >= 0) {
    const current = paragraphLines(patched[lecturerIndex]);
    const nipLine = slots.lecturerNip ? `NIP : ${slots.lecturerNip}` : (current[1] || 'NIP : -');
    patched[lecturerIndex] = replaceParagraphLines(patched[lecturerIndex], [slots.lecturerName || current[0] || '-', nipLine]);
  }

  const authorIndex = authorLabelIndex >= 0 ? nextTextIndex(patched, authorLabelIndex + 1, academicIndex >= 0 ? academicIndex : patched.length) : -1;
  if (authorIndex >= 0 && (slots.fullName || slots.studentId)) {
    patched[authorIndex] = replaceParagraphLines(patched[authorIndex], [`${slots.fullName || '-'} (${slots.studentId || '-'})`]);
    const classIndex = nextTextIndex(patched, authorIndex + 1, academicIndex >= 0 ? academicIndex : patched.length);
    if (classIndex >= 0 && slots.className) patched[classIndex] = replaceParagraphLines(patched[classIndex], [slots.className.toUpperCase()]);
  }

  if (academicIndex >= 0) {
    const current = paragraphLines(patched[academicIndex]);
    patched[academicIndex] = replaceParagraphLines(patched[academicIndex], current.map((line) => patchAcademicLine(line, slots)));
  }
  return patched;
}

function relationshipAttribute(tag, name) {
  return new RegExp(`\\b${name}="([^"]+)"`, 'i').exec(tag)?.[1] || '';
}

function contentTypeForExtension(extension) {
  return {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    bmp: 'image/bmp',
    tif: 'image/tiff',
    tiff: 'image/tiff',
    svg: 'image/svg+xml',
  }[extension.toLowerCase()] || 'application/octet-stream';
}

function ensureContentType(contentTypesXml, extension) {
  if (new RegExp(`<Default\\b[^>]*Extension="${extension}"`, 'i').test(contentTypesXml)) return contentTypesXml;
  return contentTypesXml.replace(
    /<\/Types>/i,
    `<Default Extension="${extension}" ContentType="${contentTypeForExtension(extension)}"/></Types>`,
  );
}

function mergeBodyRelationships(templateZip, reportZip, bodyXml) {
  let templateRels = templateZip.readAsText('word/_rels/document.xml.rels');
  const reportRels = reportZip.readAsText('word/_rels/document.xml.rels');
  let contentTypes = templateZip.readAsText('[Content_Types].xml');
  const reportTags = [...reportRels.matchAll(RELATIONSHIP_TAG)].map((match) => match[0]);
  const referencedIds = new Set([
    ...[...bodyXml.matchAll(/\br:embed="([^"]+)"/gi)].map((match) => match[1]),
    ...[...bodyXml.matchAll(/\br:id="([^"]+)"/gi)].map((match) => match[1]),
  ]);
  let mergedBody = bodyXml;
  let sequence = 1;

  for (const oldId of referencedIds) {
    const relationship = reportTags.find((tag) => relationshipAttribute(tag, 'Id') === oldId);
    if (!relationship) continue;
    const target = relationshipAttribute(relationship, 'Target');
    const targetMode = relationshipAttribute(relationship, 'TargetMode');
    const newId = `rIdLaprakin${sequence}`;
    sequence += 1;
    let newTarget = target;
    if (!targetMode && target && !target.startsWith('/')) {
      const sourceEntry = path.posix.normalize(`word/${target}`);
      const extension = path.posix.extname(target).slice(1).toLowerCase() || 'bin';
      newTarget = `media/laprakin-${sequence}-${path.posix.basename(target)}`;
      const data = reportZip.getEntry(sourceEntry)?.getData();
      if (!data) throw new Error(`Relasi media ${sourceEntry} tidak ditemukan.`);
      templateZip.addFile(`word/${newTarget}`, data);
      contentTypes = ensureContentType(contentTypes, extension);
    }
    const updatedRelationship = relationship
      .replace(/\bId="[^"]+"/i, `Id="${newId}"`)
      .replace(/\bTarget="[^"]+"/i, `Target="${newTarget}"`);
    templateRels = templateRels.replace(/<\/Relationships>/i, `${updatedRelationship}</Relationships>`);
    mergedBody = mergedBody
      .replaceAll(`r:embed="${oldId}"`, `r:embed="${newId}"`)
      .replaceAll(`r:id="${oldId}"`, `r:id="${newId}"`);
  }

  templateZip.updateFile('word/_rels/document.xml.rels', Buffer.from(templateRels));
  templateZip.updateFile('[Content_Types].xml', Buffer.from(contentTypes));
  return mergedBody;
}

export function inspectTemplateDocxBuffer(buffer) {
  const zip = new AdmZip(buffer);
  const documentXml = zip.readAsText('word/document.xml');
  const { body } = documentBodyParts(documentXml);
  const elements = splitTopLevelElements(body);
  const coverBoundary = detectCoverBoundary(elements);
  const bodyElements = elements.slice(coverBoundary).filter((element) => !/^<w:sectPr\b/i.test(element.trim()));
  const bodyHeadings = bodyElements
    .map(elementText)
    .filter((text) => text.length <= 140 && /^(?:bab\s+[ivxlcdm\d]+|langkah(?:\s+(?:latihan|praktikum|kerja|konfigurasi))?\b|\d+(?:\.\d+)*[.)]?\s+\S+)/i.test(text))
    .slice(0, 24);
  return {
    coverBoundary,
    coverParagraphCount: elements.slice(0, coverBoundary).filter((element) => /^<w:p\b/i.test(element.trim())).length,
    bodyHeadings,
    hasCoverImage: elements.slice(0, coverBoundary).some((element) => /\br:embed="/i.test(element)),
  };
}

export function mergeReportWithTemplate({ reportBuffer, templateBuffer, slots }) {
  const templateZip = new AdmZip(templateBuffer);
  const reportZip = new AdmZip(reportBuffer);
  const templateXml = templateZip.readAsText('word/document.xml');
  const reportXml = reportZip.readAsText('word/document.xml');
  const templateParts = documentBodyParts(templateXml);
  const reportParts = documentBodyParts(reportXml);
  const templateElements = splitTopLevelElements(templateParts.body);
  const reportElements = splitTopLevelElements(reportParts.body);
  const boundary = detectCoverBoundary(templateElements);
  const coverElements = patchCoverElements(templateElements.slice(0, boundary), slots);
  const templateSection = [...templateElements].reverse().find((element) => /^<w:sectPr\b/i.test(element.trim())) || '';
  const reportBody = reportElements.filter((element) => !/^<w:sectPr\b/i.test(element.trim())).join('');
  const mergedReportBody = mergeBodyRelationships(templateZip, reportZip, reportBody);
  const mergedXml = `${templateParts.prefix}${coverElements.join('')}${mergedReportBody}${templateSection}${templateParts.suffix}`;
  templateZip.updateFile('word/document.xml', Buffer.from(mergedXml));
  return templateZip.toBuffer();
}
