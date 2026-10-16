import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { teamApi } from '../api/teamApi';
import { useAuth } from '../context/AuthContext';
import { LoadingSpinner, EmptyState } from '../components/LoadingSpinner';
import {
  Users,
  Shield,
  ArrowRight,
  FolderGit2,
  CheckCircle2,
} from 'lucide-react';

const TeamManagement = () => {
  const { user } = useAuth();

  const {
    data: teamsData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['teams'],
    queryFn: () => teamApi.getTeams(),
  });

  const teams = teamsData?.teams || [];

  if (isLoading) {
    return <LoadingSpinner text="Fetching team scopes and memberships..." />;
  }

  if (error) {
    return (
      <div className="p-8 text-center text-danger">
        <p>Failed to load teams: {error.response?.data?.message || error.message}</p>
        <button className="btn btn-secondary mt-3" onClick={() => refetch()}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Team Work Items & Scopes</h1>
          <p className="page-subtitle">
            Overview of authorized team boundaries, active memberships, and role assignments.
          </p>
        </div>
      </div>

      {teams.length === 0 ? (
        <div className="card p-8">
          <EmptyState
            title="No authorized teams"
            description="You do not currently belong to any teams. Contact a system administrator to request access."
          />
        </div>
      ) : (
        <div className="teams-grid">
          {teams.map((team) => (
            <div key={team.id} className="team-card card">
              <div className="card-header flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-bold text-main">{team.name}</h3>
                  <p className="text-xs text-muted mt-1">{team.description}</p>
                </div>
                <span className={`role-pill role-badge-${(team.myRole || 'member').toLowerCase()}`}>
                  <Shield size={12} /> {team.myRole}
                </span>
              </div>

              <div className="card-body">
                <div className="team-members-section mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs uppercase font-bold text-muted">
                      Roster ({team.members?.length || 0} Operators)
                    </span>
                  </div>
                  <div className="team-members-list space-y-2">
                    {team.members?.map((member) => (
                      <div
                        key={member.userId}
                        className="member-item flex items-center justify-between py-1.5 px-2.5 rounded bg-app border border-border"
                      >
                        <div>
                          <span className="text-sm font-semibold text-main block">
                            {member.name}
                            {member.userId === user?.id && (
                              <span className="text-xs text-primary font-normal ml-1.5">
                                (You)
                              </span>
                            )}
                          </span>
                          <span className="text-xs font-mono text-muted">{member.email}</span>
                        </div>
                        <span className={`role-pill role-badge-${member.role.toLowerCase()}`}>
                          {member.role}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="team-actions flex justify-end pt-3 border-t border-border">
                  <Link
                    to={`/work-items?teamId=${team.id}`}
                    className="btn btn-secondary btn-sm"
                  >
                    <span>View {team.name} Items</span>
                    <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TeamManagement;
