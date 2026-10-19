'use client';
import { notFound } from 'next/navigation';
import { Ended, Left, PreJoin, Waiting } from '@/components/meet-mock/Lobby';
import { Room } from '@/components/meet-mock/Room';

type Props = { params: { screen: string }; searchParams: Record<string, string | undefined> };

/** Một màn hình của mockup. Phòng học đọc layout, panel, modal, menu từ tham số URL. */
export default function MockScreen({ params, searchParams }: Props) {
  switch (params.screen) {
    case 'prejoin':
      return <PreJoin />;
    case 'waiting':
      return <Waiting />;
    case 'left':
      return <Left />;
    case 'ended':
      return <Ended />;
    case 'room':
      // key: đổi tham số URL thì dựng lại phòng với trạng thái ban đầu mới.
      return <Room key={JSON.stringify(searchParams)} {...searchParams} />;
    default:
      notFound();
  }
}
