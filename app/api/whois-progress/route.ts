import { NextResponse } from 'next/server';

let progress = {
  processed: 0,
  total: 0,
  percentage: 0
};

export function GET() {
  return NextResponse.json(progress);
}

export function updateProgress(processed: number, total: number) {
  progress = {
    processed,
    total,
    percentage: Math.round((processed / total) * 100)
  };
} 