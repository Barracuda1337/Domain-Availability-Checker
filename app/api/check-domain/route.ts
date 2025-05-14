import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const domain = searchParams.get('domain');

    if (!domain) {
      return NextResponse.json(
        { error: 'Domain parametresi gerekli' },
        { status: 400 }
      );
    }

    const savedDomain = await prisma.savedDomain.findFirst({
      where: {
        domain: domain
      }
    });

    return NextResponse.json({ exists: !!savedDomain });
  } catch (error) {
    console.error('Domain kontrol hatası:', error);
    return NextResponse.json(
      { error: 'Domain kontrolü sırasında bir hata oluştu' },
      { status: 500 }
    );
  }
} 