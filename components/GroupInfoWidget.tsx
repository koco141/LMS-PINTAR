'use client';

import { useState, useEffect } from 'react';
import { getTrainingEnrollments, getUserById, AppUser, Enrollment, Group } from '@/lib/db';
import { Users, Crown, User as UserIcon } from 'lucide-react';

interface GroupMemberData {
  enrollment: Enrollment;
  user: AppUser | null;
}

export default function GroupInfoWidget({ 
  trainingId, 
  groupId,
  groupName
}: { 
  trainingId: string;
  groupId: string;
  groupName: string;
}) {
  const [members, setMembers] = useState<GroupMemberData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMembers();
  }, [trainingId, groupId]);

  const loadMembers = async () => {
    setLoading(true);
    const enrollments = await getTrainingEnrollments(trainingId);
    const groupEnrolls = enrollments.filter(e => e.groupId === groupId);
    
    const memberData: GroupMemberData[] = [];
    for (const e of groupEnrolls) {
      const u = await getUserById(e.userId);
      memberData.push({ enrollment: e, user: u });
    }
    
    // Sort: Leader first
    memberData.sort((a, b) => {
      if (a.enrollment.isGroupLeader && !b.enrollment.isGroupLeader) return -1;
      if (!a.enrollment.isGroupLeader && b.enrollment.isGroupLeader) return 1;
      return 0;
    });

    setMembers(memberData);
    setLoading(false);
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', backgroundColor: 'var(--bg-secondary)', borderRadius: '12px' }}>
        <div className="spinner" style={{ width: '24px', height: '24px', margin: '0 auto' }} />
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border)', maxWidth: '600px', margin: '0 auto', marginTop: '40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'rgba(79, 70, 229, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
          <Users size={20} />
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Kelompok Saya</h3>
          <p style={{ margin: '2px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{groupName}</p>
        </div>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {members.map((m, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', backgroundColor: 'var(--bg-primary)', borderRadius: '8px', border: m.enrollment.isGroupLeader ? '1px solid var(--primary-light)' : '1px solid var(--border)' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {m.enrollment.isGroupLeader ? <Crown size={16} style={{ color: '#eab308' }} /> : <UserIcon size={16} style={{ color: 'var(--text-muted)' }} />}
            </div>
            <div>
              <p style={{ margin: 0, fontWeight: 600, fontSize: '0.95rem' }}>{m.user?.name || 'User Tanpa Nama'}</p>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {m.enrollment.isGroupLeader ? '👑 Ketua Kelompok' : 'Anggota'}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
