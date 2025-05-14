import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const domains = await prisma.savedDomain.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(domains);
  } catch (error) {
    return NextResponse.json(
      { error: 'Domainler yüklenirken bir hata oluştu' },
      { status: 500 }
    );
  }
} 