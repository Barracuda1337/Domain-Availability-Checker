import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { domain } = await request.json();

    if (!domain) {
      return NextResponse.json(
        { error: 'Domain adı gerekli' },
        { status: 400 }
      );
    }

    const savedDomain = await prisma.savedDomain.create({
      data: {
        domain,
      },
    });

    return NextResponse.json(savedDomain);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Bu domain zaten kaydedilmiş' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Bir hata oluştu' },
      { status: 500 }
    );
  }
} 