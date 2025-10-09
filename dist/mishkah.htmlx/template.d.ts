import { TemplateDescriptor } from './types';
interface TemplateExtractionOptions {
    hash?: (value: string) => string;
}
export declare function extractTemplates(html: string, options?: TemplateExtractionOptions): TemplateDescriptor[];
export {};
