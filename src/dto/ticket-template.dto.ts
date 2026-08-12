export interface CreateTicketTemplateDto {
  name: string;
  layout: Array<{
    type: string;
    x: number;
    y: number;
    width: number;
    height: number;
    content?: string;
    variable?: string;
    fontSize?: number;
    fontWeight?: string;
    textAlign?: string;
  }>;
  width_mm?: number;
  height_mm?: number;
  footer_text?: string;
  show_qr?: boolean;
  show_barcode?: boolean;
  is_default?: boolean;
}

export interface UpdateTicketTemplateDto {
  name?: string;
  layout?: CreateTicketTemplateDto["layout"];
  width_mm?: number;
  height_mm?: number;
  footer_text?: string;
  show_qr?: boolean;
  show_barcode?: boolean;
  is_default?: boolean;
}
