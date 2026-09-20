import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeftIcon } from 'lucide-react';
import { api } from '@/lib/api/server';
import { PageContainer, PageHeader } from '@/components/shell/PageHeader';
import { WarehouseStockEditor } from '@/components/delivery/WarehouseStockEditor';
import { requirePermission } from '@/lib/auth/requireAdmin';

export const metadata: Metadata = { title: 'What this warehouse stocks' };

export default async function WarehouseStockPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission('delivery:write');
  const { id } = await params;

  const client = await api();
  const [warehouses, page] = await Promise.all([
    client.operations.warehouses.query(),
    client.operations.warehouseStock.query({ warehouseId: id }),
  ]);

  const warehouse = warehouses.find((row) => row.id === id);
  if (!warehouse) notFound();

  return (
    <PageContainer>
      <PageHeader
        title={warehouse.name}
        subtitle={`${warehouse.code} · ${warehouse.city} ${warehouse.pincode}`}
        actions={
          <Link
            href="/delivery/warehouses"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors"
          >
            <ChevronLeftIcon className="size-4" />
            All warehouses
          </Link>
        }
      />

      {/*
        Said plainly, because the two numbers sit side by side on this screen and
        confusing them would be expensive: this list decides where goods travel
        from, not whether they can be sold.
      */}
      <p className="text-muted-foreground mb-4 max-w-[640px] text-sm">
        What is held here decides which orders route through this warehouse, and so how far the
        delivery is. It is not the sellable stock — that stays on the product, and nothing on this
        screen can stop a sale or is changed when an order is placed.
      </p>

      <WarehouseStockEditor
        warehouseId={id}
        initial={page.rows}
        initialCursor={page.nextCursor}
      />
    </PageContainer>
  );
}
