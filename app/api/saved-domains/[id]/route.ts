import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: paramId } = await context.params;

    if (!paramId) {
      return NextResponse.json(
        { error: 'ID parametresi gerekli' },
        { status: 400 }
      );
    }

    const id = parseInt(paramId);
    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Geçersiz ID formatı' },
        { status: 400 }
      );
    }

    await prisma.savedDomain.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Domain silme hatası:', error);
    return NextResponse.json(
      { error: 'Domain silinirken bir hata oluştu' },
      { status: 500 }
    );
  }
} 