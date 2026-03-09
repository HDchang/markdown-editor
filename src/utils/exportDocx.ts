import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';

// GB/T 9704-2012 公文格式配置
const DOCUMENT_STYLES = {
  // 页边距 (单位: Twips, 1cm = 567)
  margins: {
    top: 2098,    // 37mm
    bottom: 1985, // 35mm
    left: 1587,   // 28mm
    right: 1474,  // 26mm
  },
  // 字体
  fonts: {
    title: '方正小标宋简体',
    body: '仿宋_GB2312',
    black: '黑体',
    kai: '楷体',
  },
  // 字号 (half-points, 1pt = 2 half-points)
  sizes: {
    title: 44,    // 二号 = 22pt = 44 half-points
    body: 31,     // 三号 = 15.5pt = 31 half-points
  },
  // 行间距：固定值28磅 (28pt = 28 * 20 = 560 twips)
  lineSpacing: 560,
};

// 解析 HTML 内容
function parseHtmlContent(html: string) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const elements: { level: number; text: string; type: 'heading' | 'para' | 'list' }[] = [];

  // 处理所有元素
  const processNode = (node: Node, level: number = 0) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;
      const tagName = element.tagName.toLowerCase();

      if (tagName === 'h1') {
        elements.push({ level: 1, text: element.textContent?.trim() || '', type: 'heading' });
      } else if (tagName === 'h2') {
        elements.push({ level: 2, text: element.textContent?.trim() || '', type: 'heading' });
      } else if (tagName === 'h3' || tagName === 'h4' || tagName === 'h5' || tagName === 'h6') {
        elements.push({ level: 3, text: element.textContent?.trim() || '', type: 'heading' });
      } else if (tagName === 'p') {
        const text = element.textContent?.trim() || '';
        if (text) {
          elements.push({ level: 0, text, type: 'para' });
        }
      } else if (tagName === 'ul' || tagName === 'ol') {
        element.querySelectorAll('li').forEach((li) => {
          elements.push({ level: 3, text: li.textContent?.trim() || '', type: 'list' });
        });
      }

      element.childNodes.forEach(child => processNode(child, level));
    }
  };

  doc.body.childNodes.forEach(node => processNode(node));

  return elements;
}

// 生成公文格式 DOCX (GB/T 9704-2012)
export async function exportToOfficialDocx(html: string, fileName: string = '公文.docx') {
  const elements = parseHtmlContent(html);
  const children: Paragraph[] = [];

  // 生成公文标题段落
  for (const el of elements) {
    if (el.type === 'heading' && el.level === 1) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: el.text,
              font: DOCUMENT_STYLES.fonts.title,
              size: DOCUMENT_STYLES.sizes.title,
              bold: true,
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: {
            before: 0,
            after: DOCUMENT_STYLES.lineSpacing,
          },
        })
      );
      break;
    }
  }

  // 处理正文内容
  for (const el of elements) {
    if (el.type === 'heading') {
      if (el.level === 1) {
        // 一级标题 → 一、（3号黑体）
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: el.text,
                font: DOCUMENT_STYLES.fonts.black,
                size: DOCUMENT_STYLES.sizes.body,
                bold: true,
              }),
            ],
            spacing: {
              before: DOCUMENT_STYLES.lineSpacing,
              after: DOCUMENT_STYLES.lineSpacing / 2,
            },
          })
        );
      } else if (el.level === 2) {
        // 二级标题 → （一）（3号楷体）
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: el.text,
                font: DOCUMENT_STYLES.fonts.kai,
                size: DOCUMENT_STYLES.sizes.body,
                bold: true,
              }),
            ],
            spacing: {
              before: DOCUMENT_STYLES.lineSpacing,
              after: DOCUMENT_STYLES.lineSpacing / 2,
            },
          })
        );
      } else {
        // 三级及以下 → 1. （3号仿宋）
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: el.text,
                font: DOCUMENT_STYLES.fonts.body,
                size: DOCUMENT_STYLES.sizes.body,
              }),
            ],
            spacing: {
              before: DOCUMENT_STYLES.lineSpacing / 2,
              after: DOCUMENT_STYLES.lineSpacing / 2,
            },
          })
        );
      }
    } else if (el.type === 'para') {
      // 正文段落（3号仿宋，首行缩进2字符）
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: el.text,
              font: DOCUMENT_STYLES.fonts.body,
              size: DOCUMENT_STYLES.sizes.body,
            }),
          ],
          indent: {
            firstLine: 720, // 首行缩进2字符
          },
          spacing: {
            line: DOCUMENT_STYLES.lineSpacing, // 固定28磅行距
          },
        })
      );
    } else if (el.type === 'list') {
      // 列表项（3号仿宋）
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: el.text,
              font: DOCUMENT_STYLES.fonts.body,
              size: DOCUMENT_STYLES.sizes.body,
            }),
          ],
          indent: {
            firstLine: 720,
          },
          spacing: {
            line: DOCUMENT_STYLES.lineSpacing,
          },
        })
      );
    }
  }

  // 如果没有内容，添加提示
  if (children.length === 0) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: '（正文内容）',
            font: DOCUMENT_STYLES.fonts.body,
            size: DOCUMENT_STYLES.sizes.body,
          }),
        ],
        indent: {
          firstLine: 720,
        },
        spacing: {
          line: DOCUMENT_STYLES.lineSpacing,
        },
      })
    );
  }

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: DOCUMENT_STYLES.margins,
        },
      },
      children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  const arrayBuffer = await blob.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  
  // 使用 Tauri dialog 保存文件
  const filePath = await save({
    defaultPath: fileName,
    filters: [{ name: 'Word Document', extensions: ['docx'] }]
  });
  
  if (filePath) {
    // 将二进制转换为 base64 然后保存
    const base64 = btoa(String.fromCharCode.apply(null, uint8Array as any));
    await invoke('write_binary_file', { path: filePath, content: base64 });
  }
}

// 生成普通 DOCX
export async function exportToDocx(html: string, fileName: string = 'document.docx') {
  const elements = parseHtmlContent(html);
  const children: Paragraph[] = [];

  for (const el of elements) {
    if (el.type === 'heading') {
      const headingLevel = el.level === 1 ? HeadingLevel.HEADING_1 :
                          el.level === 2 ? HeadingLevel.HEADING_2 :
                          HeadingLevel.HEADING_3;
      children.push(
        new Paragraph({
          text: el.text,
          heading: headingLevel,
          spacing: {
            before: 240,
            after: 120,
          },
        })
      );
    } else if (el.text.trim()) {
      children.push(
        new Paragraph({
          text: el.text,
          spacing: {
            line: 560,
          },
        })
      );
    }
  }

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
        },
      },
      children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  const arrayBuffer = await blob.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  
  // 使用 Tauri dialog 保存文件
  const filePath = await save({
    defaultPath: fileName,
    filters: [{ name: 'Word Document', extensions: ['docx'] }]
  });
  
  if (filePath) {
    // 将二进制转换为 base64 然后保存
    const base64 = btoa(String.fromCharCode.apply(null, uint8Array as any));
    await invoke('write_binary_file', { path: filePath, content: base64 });
  }
}
