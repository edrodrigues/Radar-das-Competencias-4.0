'use client';

import { ReactNode, useCallback, useEffect, useState } from 'react';
import { initialSurveyState, SurveyContext, SurveyContextType } from './survey-context';
import { SurveyService } from './survey.service';
import { 
  OpenQuestionResponses, 
  ProfileFormValues, 
  SurveyFormValues,
  OpenQuestionsFormValues,
  SurveyState 
} from './survey-model';
import { useAuth } from '@/resources/auth/auth-hook';
import { useTeam } from '@/resources/team/team-hook';
import { supabase } from '../auth/auth.service';


interface SurveyProviderProps {
  children: ReactNode;
}

export function SurveyProvider({ children }: SurveyProviderProps) {
  const [state, setState] = useState<SurveyState>(initialSurveyState);
  const { user } = useAuth();
  const { selectedTeam, teamMembers, loadTeamMembers } = useTeam();

  // Método para atualizar o estado de loading e erro
  const updateLoading = useCallback((isLoading: boolean, error: string | null = null) => {
    setState(prev => ({ ...prev, isLoading, error }));
  }, []);

  // Método para atualizar o teamMemberId
  const updateTeamMemberId = useCallback((teamMemberId: string | null) => {
    if (teamMemberId) {
      setState(prev => ({ ...prev, teamMemberId }));
    }
  }, []);

  // Buscar o ID do membro da equipe com base no email do usuário e no ID da equipe
  const fetchTeamMemberId = useCallback(async () => {
    if (!user?.email) return null;
    
    try {
      updateLoading(true);
      
      // Primeiro, verificar se temos o ID da equipe
      const teamId = selectedTeam?.id || localStorage.getItem("teamId");
      
      if (!teamId) {
        throw new Error("ID da equipe não encontrado");
      }
      
      // Verificar se já temos os membros da equipe carregados
      if (teamMembers.length === 0) {
        await loadTeamMembers(teamId);
      }
      
      // Buscar o membro da equipe pelo email do usuário
      const member = teamMembers.find(m => m.email === user.email);
      
      // Se não encontrar nos membros carregados, buscar diretamente no banco
      if (!member) {
        const { data, error } = await supabase
          .from('team_members')
          .select('id')
          .eq('team_id', teamId)
          .eq('email', user.email)
          .single();
        
        if (error) {
          // Se não encontrar, criar um novo registro de membro
          const { data: newMember, error: insertError } = await supabase
            .from('team_members')
            .insert({
              team_id: teamId,
              email: user.email,
              role: 'member', // Assumir papel de membro por padrão
              status: 'cadastrado', // Marcar como cadastrado
              user_id: user.id
            })
            .select('id')
            .single();
          
          if (insertError) {
            throw new Error(`Erro ao criar membro da equipe: ${insertError.message}`);
          }
          
          updateTeamMemberId(newMember.id);
          updateLoading(false);
          return newMember.id;
        }
        
        updateTeamMemberId(data.id);
        updateLoading(false);
        return data.id;
      }
      
      if (member.id) {
        updateTeamMemberId(member.id);
        updateLoading(false);
        return member.id;
      }
      
      throw new Error("ID do membro da equipe não encontrado");
    } catch (error: any) {
      console.error('Erro ao buscar ID do membro da equipe:', error);
      updateLoading(false, error.message || 'Erro ao buscar ID do membro da equipe');
      return null;
    }
  }, [user, selectedTeam, teamMembers, loadTeamMembers, updateLoading, updateTeamMemberId]);

  // Carregar dados do perfil do usuário
  const loadProfile = useCallback(async () => {
    try {
      updateLoading(true);
      
      // Garantir que temos o ID do membro da equipe
      const teamMemberId = state.teamMemberId || await fetchTeamMemberId();
      
      if (!teamMemberId) {
        throw new Error("ID do membro da equipe não encontrado");
      }
      
      const profile = await SurveyService.loadProfile(teamMemberId);
      
      setState(prev => ({ ...prev, profile }));
      updateLoading(false);
      
      return profile;
    } catch (error: any) {
      console.error('Erro ao carregar perfil:', error);
      updateLoading(false, error.message || 'Erro ao carregar perfil');
      return null;
    }
  }, [state.teamMemberId, fetchTeamMemberId, updateLoading]);

  // Salvar perfil do usuário
  const saveProfile = useCallback(async (data: ProfileFormValues) => {
    try {
      updateLoading(true);
      
      // Garantir que temos o ID do membro da equipe
      const teamMemberId = state.teamMemberId || await fetchTeamMemberId();
      
      if (!teamMemberId) {
        throw new Error("ID do membro da equipe não encontrado");
      }
      
      const profile = await SurveyService.saveProfile(teamMemberId, data);
      
      setState(prev => ({ ...prev, profile }));
      updateTeamMemberId(teamMemberId);
      updateLoading(false);
      
      return profile;
    } catch (error: any) {
      console.error('Erro ao salvar perfil:', error);
      updateLoading(false, error.message || 'Erro ao salvar perfil');
      return null;
    }
  }, [state.teamMemberId, fetchTeamMemberId, updateLoading, updateTeamMemberId]);

  // Carregar respostas do questionário
  const loadSurveyResponses = useCallback(async () => {
    try {
      updateLoading(true);
      
      // Garantir que temos o ID do membro da equipe
      const teamMemberId = state.teamMemberId || await fetchTeamMemberId();
      
      if (!teamMemberId) {
        throw new Error("ID do membro da equipe não encontrado");
      }
      
      const responses = await SurveyService.loadSurveyResponses(teamMemberId);
      
      setState(prev => ({ ...prev, surveyResponses: responses }));
      updateLoading(false);
      
      return responses;
    } catch (error: any) {
      console.error('Erro ao carregar respostas do questionário:', error);
      updateLoading(false, error.message || 'Erro ao carregar respostas do questionário');
      return null;
    }
  }, [state.teamMemberId, fetchTeamMemberId, updateLoading]);

  // Salvar respostas do questionário
  const saveSurveyResponses = useCallback(async (data: SurveyFormValues) => {
    try {
      updateLoading(true);
      
      // Garantir que temos o ID do membro da equipe
      const teamMemberId = state.teamMemberId || await fetchTeamMemberId();
      
      if (!teamMemberId) {
        throw new Error("ID do membro da equipe não encontrado");
      }
      
      const responses = await SurveyService.saveSurveyResponses(teamMemberId, data);
      
      setState(prev => ({ ...prev, surveyResponses: responses }));
      updateLoading(false);
      
      return responses;
    } catch (error: any) {
      console.error('Erro ao salvar respostas do questionário:', error);
      updateLoading(false, error.message || 'Erro ao salvar respostas do questionário');
      return null;
    }
  }, [state.teamMemberId, fetchTeamMemberId, updateLoading]);

  // Carregar respostas das perguntas abertas
  const loadOpenQuestionResponses = useCallback(async () => {
    try {
      updateLoading(true);
      
      // Garantir que temos o ID do membro da equipe
      const teamMemberId = state.teamMemberId || await fetchTeamMemberId();
      
      if (!teamMemberId) {
        throw new Error("ID do membro da equipe não encontrado");
      }
      
      const responses = await SurveyService.loadOpenQuestionResponses(teamMemberId);
      
      setState(prev => ({ ...prev, openQuestionResponses: responses }));
      updateLoading(false);
      
      return responses;
    } catch (error: any) {
      console.error('Erro ao carregar respostas das perguntas abertas:', error);
      updateLoading(false, error.message || 'Erro ao carregar respostas das perguntas abertas');
      return null;
    }
  }, [state.teamMemberId, fetchTeamMemberId, updateLoading]);

  // Salvar respostas das perguntas abertas
  const saveOpenQuestionResponses = useCallback(async (data: OpenQuestionResponses) => {
    try {
      updateLoading(true);
      
      // Garantir que temos o ID do membro da equipe
      const teamMemberId = state.teamMemberId || await fetchTeamMemberId();
      
      if (!teamMemberId) {
        throw new Error("ID do membro da equipe não encontrado");
      }
      
      const responses = await SurveyService.saveOpenQuestionResponses(teamMemberId, data);
      
      // Atualizar o status do membro para "respondido"
      try {
        await SurveyService.updateMemberStatus(teamMemberId, 'respondido');
        console.log("Status do membro atualizado para 'respondido'");
      } catch (statusError: any) {
        console.error("Erro ao atualizar status do membro:", statusError);
        
        // Tentar uma abordagem alternativa
        try {
          // Atualizar diretamente no banco de dados usando o valor em inglês
          const { error } = await supabase
            .from('team_members')
            .update({ 
              status: 'completed', // Usar 'completed' em vez de 'respondido'
              updated_at: new Date().toISOString() 
            })
            .eq('id', teamMemberId);
          
          if (error) {
            console.error("Erro na abordagem alternativa:", error);
          } else {
            console.log("Status atualizado com abordagem alternativa");
          }
        } catch (alternativeError) {
          console.error("Erro na abordagem alternativa:", alternativeError);
        }
      }
      
      setState(prev => ({ ...prev, openQuestionResponses: responses }));
      updateLoading(false);
      
      return responses;
    } catch (error: any) {
      console.error('Erro ao salvar respostas das perguntas abertas:', error);
      updateLoading(false, error.message || 'Erro ao salvar respostas das perguntas abertas');
      return null;
    }
  }, [state.teamMemberId, fetchTeamMemberId, updateLoading]);
  
  // Alias para compatibilidade com a página de perguntas abertas
  const saveOpenQuestions = useCallback(async (data: OpenQuestionsFormValues) => {
    return saveOpenQuestionResponses(data);
  }, [saveOpenQuestionResponses]);
  
  // Função para marcar todas as etapas como concluídas
  const completeAllSteps = useCallback(async () => {
    try {
      updateLoading(true);
      
      // Garantir que temos o ID do membro da equipe
      const teamMemberId = state.teamMemberId || await fetchTeamMemberId();
      
      if (!teamMemberId) {
        throw new Error("ID do membro da equipe não encontrado");
      }
      
      // Verificar se todas as etapas foram concluídas
      const isComplete = await SurveyService.checkSurveyCompletion(teamMemberId);
      
      if (isComplete) {
        // Atualizar o status do membro para "respondido"
        try {
          await SurveyService.updateMemberStatus(teamMemberId, 'respondido');
          console.log("Status do membro atualizado para 'respondido'");
        } catch (statusError: any) {
          console.error("Erro ao atualizar status do membro:", statusError);
          
          // Tentar uma abordagem alternativa
          try {
            // Atualizar diretamente no banco de dados usando o valor em inglês
            const { error } = await supabase
              .from('team_members')
              .update({ 
                status: 'completed', // Usar 'completed' em vez de 'respondido'
                updated_at: new Date().toISOString() 
              })
              .eq('id', teamMemberId);
            
            if (error) {
              console.error("Erro na abordagem alternativa:", error);
            } else {
              console.log("Status atualizado com abordagem alternativa");
            }
          } catch (alternativeError) {
            console.error("Erro na abordagem alternativa:", alternativeError);
          }
        }
      }
      
      updateLoading(false);
      return isComplete;
    } catch (error: any) {
      console.error('Erro ao verificar conclusão das etapas:', error);
      updateLoading(false, error.message || 'Erro ao verificar conclusão das etapas');
      return false;
    }
  }, [state.teamMemberId, fetchTeamMemberId, updateLoading]);

  // Inicializar o provider
  useEffect(() => {
    if (user?.email) {
      fetchTeamMemberId();
    }
  }, [user, fetchTeamMemberId]);

  // Carregar dados do localStorage ao inicializar
  useEffect(() => {
    const loadFromLocalStorage = () => {
      try {
        // Carregar perfil
        const profileStr = localStorage.getItem('userProfile');
        if (profileStr) {
          const profile = JSON.parse(profileStr);
          setState(prevState => ({
            ...prevState,
            profile
          }));
        }

        // Carregar respostas do questionário
        const responsesStr = localStorage.getItem('surveyResponses');
        if (responsesStr) {
          const responses = JSON.parse(responsesStr);
          setState(prevState => ({
            ...prevState,
            surveyResponses: responses
          }));
        }

        // Carregar respostas das perguntas abertas
        const openQuestionsStr = localStorage.getItem('openQuestionsResponses');
        if (openQuestionsStr) {
          const openQuestions = JSON.parse(openQuestionsStr);
          setState(prevState => ({
            ...prevState,
            openQuestionResponses: openQuestions
          }));
        }
      } catch (error) {
        console.error('Erro ao carregar dados do localStorage:', error);
      }
    };

    loadFromLocalStorage();
  }, []);

  // Criar o valor do contexto
  const contextValue: SurveyContextType = {
    state,
    loadProfile,
    saveProfile,
    loadSurveyResponses,
    saveSurveyResponses,
    loadOpenQuestionResponses,
    saveOpenQuestionResponses,
    saveOpenQuestions,
    completeAllSteps,
    updateLoading,
    fetchTeamMemberId,
    updateTeamMemberId
  };

  return (
    <SurveyContext.Provider value={contextValue}>
      {children}
    </SurveyContext.Provider>
  );
} 