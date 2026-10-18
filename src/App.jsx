import React from 'react';
import GanttMario from './GanttMario';

export default function App() {
  const sheetData = [
    {
      index_: 0,
      data: [
        {
          index_: 0,
          row: [
            "ID/Fase", 
            "Nome da Tarefa / Etapa do Projeto", 
            "Responsável / Marco de Validação", 
            "Início", 
            "Fim", 
            "Duração (Semanas)", 
            "Status"
          ]
        },
        {
          index_: 1,
          row: ["Fase 1", "Definição do Escopo e Arquitetura", "Aprovação do Orientador", "2026-08-10", "2026-08-23", 2, "Concluído"]
        },
        {
          index_: 2,
          row: ["Fase 2", "Modelagem 3D do Chassi e Mecânica", "Peças validadas no CAD", "2026-08-24", "2026-09-06", 2, "Em Andamento"]
        },
        {
          index_: 3,
          row: ["Fase 3", "Circuito Eletrônico e Placa PCB", "Simulação sem curto", "2026-09-07", "2026-09-20", 2, "Pendente"]
        },
        {
          index_: 4,
          row: ["Fase 4", "Firmware de Controle e Sensores", "Leitura de PID calibrada", "2026-09-21", "2026-10-11", 3, "Pendente"]
        },
        {
          index_: 5,
          row: ["Fase 5", "Montagem e Integração Física", "Robô ligado na bateria", "2026-10-12", "2026-10-25", 2, "Pendente"]
        },
        {
          index_: 6,
          row: ["Fase 6", "Testes em Pista e Ajustes Finais", "Trajeto sem colisões", "2026-10-26", "2026-11-15", 3, "Pendente"]
        },
        {
          index_: 7,
          row: ["Fase 7", "Documentação e Artigo do Projeto", "Entrega na Banca", "2026-11-16", "2026-12-05", 3, "Pendente"]
        }
      ]
    }
  ];

  return (
    <GanttMario
      data={sheetData}
      updateItem={(s, r, newRow) => console.log('Update:', newRow)}
      deleteItem={(s, r) => console.log('Delete:', r)}
      insertItem={(s, r, newRow) => console.log('Insert:', newRow)}
    />
  );
}