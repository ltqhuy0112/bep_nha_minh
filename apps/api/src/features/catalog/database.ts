export type CatalogQueryResult<Row extends Record<string, unknown>> = {
  rows: Row[];
};

// Compatible with pg.Client and pg.Pool; the catalog feature uses parameterized read queries only.
export type CatalogDatabase = {
  query<Row extends Record<string, unknown>>(
    text: string,
    values?: unknown[]
  ): Promise<CatalogQueryResult<Row>>;
};
