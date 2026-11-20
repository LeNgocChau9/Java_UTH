declare module "mermaid" {
  const mermaid: {
    initialize: (config: any) => void;
    render: (id: string, text: string) => Promise<{ svg: string }>;
    [key: string]: any;
  };
  export default mermaid;
}
