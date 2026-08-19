import {
  buildRound,
  nextResponsible,
  roundsPerMember,
  scaleQuantities,
  totalDrinks,
  RoundValidationError,
} from '../rounds';
import { makeProduct } from './fixtures';

const base = {
  sessionId: 'sess-1',
  roundNumber: 1,
  requestedBy: 'prof-joao',
  createdBy: 'prof-joao',
  createdAt: '2026-08-15T21:00:00Z',
  memberIds: ['prof-joao', 'prof-ana', 'prof-rui'],
};

describe('buildRound', () => {
  it('calcula o total do artigo a partir do preço à data', () => {
    const imperial = makeProduct({ id: 'p-imp', current_price: 1.2 });

    const round = buildRound({
      ...base,
      products: [imperial],
      items: [{ productId: 'p-imp', quantity: 3 }],
    });

    expect(round.items[0].unit_price).toBe(1.2);
    expect(round.items[0].total_price).toBe(3.6);
    expect(round.total_amount).toBe(3.6);
  });

  it('congela o snapshot dos membros na rodada', () => {
    const imperial = makeProduct({ id: 'p-imp' });

    const round = buildRound({
      ...base,
      products: [imperial],
      items: [{ productId: 'p-imp', quantity: 3 }],
    });

    expect(round.member_count).toBe(3);
    expect(round.member_ids).toEqual(['prof-joao', 'prof-ana', 'prof-rui']);
  });

  it('regista o responsável — quem paga esta rodada', () => {
    const imperial = makeProduct({ id: 'p-imp' });

    const round = buildRound({
      ...base,
      requestedBy: 'prof-ana',
      products: [imperial],
      items: [{ productId: 'p-imp', quantity: 2 }],
    });

    expect(round.requested_by).toBe('prof-ana');
  });

  it('aceita bebidas diferentes na mesma rodada', () => {
    const caneca = makeProduct({ id: 'p-can', name: 'Caneca', current_price: 2.0 });
    const agua = makeProduct({ id: 'p-agua', name: 'Água', current_price: 1.0 });

    const round = buildRound({
      ...base,
      products: [caneca, agua],
      items: [
        { productId: 'p-can', quantity: 8 },
        { productId: 'p-agua', quantity: 2 },
      ],
    });

    expect(totalDrinks(round)).toBe(10);
    expect(round.total_amount).toBe(18.0);
  });

  it('não exige que as bebidas igualem o número de membros', () => {
    // 3 membros, 5 bebidas: a referência é o número de membros, mas o pedido
    // real é o que o responsável decidir.
    const imperial = makeProduct({ id: 'p-imp' });

    const round = buildRound({
      ...base,
      products: [imperial],
      items: [{ productId: 'p-imp', quantity: 5 }],
    });

    expect(totalDrinks(round)).toBe(5);
    expect(round.member_count).toBe(3);
  });

  it('recusa uma rodada sem bebidas', () => {
    expect(() => buildRound({ ...base, products: [], items: [] })).toThrow(
      'a rodada tem de ter pelo menos uma bebida',
    );
  });

  it('recusa uma rodada sem responsável', () => {
    const imperial = makeProduct({ id: 'p-imp' });

    expect(() =>
      buildRound({
        ...base,
        requestedBy: '',
        products: [imperial],
        items: [{ productId: 'p-imp', quantity: 1 }],
      }),
    ).toThrow('a rodada tem de ter um responsável');
  });

  it('recusa quantidades não positivas', () => {
    const imperial = makeProduct({ id: 'p-imp' });

    expect(() =>
      buildRound({
        ...base,
        products: [imperial],
        items: [{ productId: 'p-imp', quantity: 0 }],
      }),
    ).toThrow(RoundValidationError);
  });

  it('recusa um produto desconhecido', () => {
    expect(() =>
      buildRound({
        ...base,
        products: [],
        items: [{ productId: 'p-fantasma', quantity: 1 }],
      }),
    ).toThrow('produto desconhecido: p-fantasma');
  });

  it('nasce com estado ativo', () => {
    const imperial = makeProduct({ id: 'p-imp' });
    const round = buildRound({
      ...base,
      products: [imperial],
      items: [{ productId: 'p-imp', quantity: 1 }],
    });

    expect(round.status).toBe('active');
  });
});

describe('nextResponsible', () => {
  const imperial = makeProduct({ id: 'p-imp' });

  const rodadaDe = (memberId: string, roundNumber: number, memberIds: string[]) =>
    buildRound({
      ...base,
      requestedBy: memberId,
      roundNumber,
      memberIds,
      products: [imperial],
      items: [{ productId: 'p-imp', quantity: memberIds.length }],
    });

  it('sugere quem ainda não pediu', () => {
    const membros = ['nelio', 'martinho', 'ze', 'joao', 'rui'];
    const rounds = [
      rodadaDe('nelio', 1, membros),
      rodadaDe('martinho', 2, membros),
      rodadaDe('ze', 3, membros),
    ];

    expect(nextResponsible(rounds, membros)).toBe('joao');
  });

  it('recomeça o ciclo quando todos já pediram', () => {
    const membros = ['nelio', 'martinho'];
    const rounds = [rodadaDe('nelio', 1, membros), rodadaDe('martinho', 2, membros)];

    // Ambos com uma rodada: o desempate cai em quem pediu há mais tempo.
    expect(nextResponsible(rounds, membros)).toBe('nelio');
  });

  it('só sugere membros que estão na noite', () => {
    const membros = ['nelio', 'martinho', 'ze'];
    const rounds = [rodadaDe('nelio', 1, membros)];

    // O Zé foi embora: mesmo sem rodadas, não pode ser sugerido.
    expect(nextResponsible(rounds, ['nelio', 'martinho'])).toBe('martinho');
  });

  it('ignora rodadas canceladas na contagem', () => {
    const membros = ['nelio', 'martinho'];
    const cancelada = { ...rodadaDe('martinho', 1, membros), status: 'cancelled' as const };

    expect(nextResponsible([cancelada], membros)).toBe('nelio');
  });

  it('devolve null sem membros na noite', () => {
    expect(nextResponsible([], [])).toBeNull();
  });
});

describe('roundsPerMember', () => {
  it('inclui quem ainda vai a zero — o ecrã mostra quem falta', () => {
    const imperial = makeProduct({ id: 'p-imp' });
    const membros = ['nelio', 'rui'];
    const rounds = [
      buildRound({
        ...base,
        requestedBy: 'nelio',
        memberIds: membros,
        products: [imperial],
        items: [{ productId: 'p-imp', quantity: 2 }],
      }),
    ];

    const counts = roundsPerMember(rounds, membros);
    expect(counts.get('nelio')).toBe(1);
    expect(counts.get('rui')).toBe(0);
  });
});

describe('scaleQuantities', () => {
  it('adapta a rodada anterior ao número atual de membros', () => {
    // 10 cervejas para 10 membros; saíram 2 → sugestão de 8.
    expect(scaleQuantities([{ productId: 'p-imp', quantity: 10 }], 10, 8)).toEqual([
      { productId: 'p-imp', quantity: 8 },
    ]);
  });

  it('escala para cima quando entram membros', () => {
    expect(scaleQuantities([{ productId: 'p-imp', quantity: 8 }], 8, 12)).toEqual([
      { productId: 'p-imp', quantity: 12 },
    ]);
  });

  it('escala proporcionalmente bebidas diferentes', () => {
    const scaled = scaleQuantities(
      [
        { productId: 'p-can', quantity: 8 },
        { productId: 'p-agua', quantity: 2 },
      ],
      10,
      5,
    );

    expect(scaled).toEqual([
      { productId: 'p-can', quantity: 4 },
      { productId: 'p-agua', quantity: 1 },
    ]);
  });

  it('remove artigos que caem a zero', () => {
    expect(scaleQuantities([{ productId: 'p-agua', quantity: 1 }], 10, 2)).toEqual([]);
  });

  it('devolve as quantidades originais sem contagem anterior', () => {
    expect(scaleQuantities([{ productId: 'p-imp', quantity: 6 }], 0, 8)).toEqual([
      { productId: 'p-imp', quantity: 6 },
    ]);
  });
});

describe('uma noite completa', () => {
  it('10 membros → rodada → rodada → saem 2 → rodada → entram 4 → rodada baseada na anterior', () => {
    const imperial = makeProduct({ id: 'p-imp', current_price: 1.5 });
    const dez = ['nelio', 'martinho', 'ze', 'joao', 'rui', 'm6', 'm7', 'm8', 'm9', 'm10'];

    // 18:30 — Rodada 1, Nélio, 10 membros.
    const r1 = buildRound({
      ...base,
      requestedBy: 'nelio',
      roundNumber: 1,
      memberIds: dez,
      products: [imperial],
      items: [{ productId: 'p-imp', quantity: 10 }],
    });

    // 19:15 — Rodada 2, sugestão aponta a quem não pediu; Martinho pede.
    expect(nextResponsible([r1], dez)).not.toBe('nelio');
    const r2 = buildRound({
      ...base,
      requestedBy: 'martinho',
      roundNumber: 2,
      memberIds: dez,
      products: [imperial],
      items: [{ productId: 'p-imp', quantity: 10 }],
    });

    // 20:00 — saem 2. A rodada seguinte parte da anterior, ajustada.
    const oito = dez.slice(0, 8);
    const sugestao3 = scaleQuantities(
      r2.items.map((i) => ({ productId: i.product_id, quantity: i.quantity })),
      r2.member_count ?? 0,
      oito.length,
    );
    expect(sugestao3).toEqual([{ productId: 'p-imp', quantity: 8 }]);

    const r3 = buildRound({
      ...base,
      requestedBy: 'ze',
      roundNumber: 3,
      memberIds: oito,
      products: [imperial],
      items: sugestao3,
    });

    // 21:00 — entram 4. Nova rodada baseada na anterior.
    const doze = [...oito, 'novo1', 'novo2', 'novo3', 'novo4'];
    const sugestao4 = scaleQuantities(
      r3.items.map((i) => ({ productId: i.product_id, quantity: i.quantity })),
      r3.member_count ?? 0,
      doze.length,
    );
    expect(sugestao4).toEqual([{ productId: 'p-imp', quantity: 12 }]);

    const r4 = buildRound({
      ...base,
      requestedBy: 'joao',
      roundNumber: 4,
      memberIds: doze,
      products: [imperial],
      items: sugestao4,
    });

    // O histórico guarda o estado real de cada momento — as rodadas antigas
    // não mudam quando os membros entram ou saem.
    const historico = [r1, r2, r3, r4].map((r) => ({
      responsavel: r.requested_by,
      membros: r.member_count,
      bebidas: totalDrinks(r),
    }));

    expect(historico).toEqual([
      { responsavel: 'nelio', membros: 10, bebidas: 10 },
      { responsavel: 'martinho', membros: 10, bebidas: 10 },
      { responsavel: 'ze', membros: 8, bebidas: 8 },
      { responsavel: 'joao', membros: 12, bebidas: 12 },
    ]);

    // Quem falta pedir: os counts a zero.
    const counts = roundsPerMember([r1, r2, r3, r4], doze);
    expect(counts.get('rui')).toBe(0);
    expect(counts.get('nelio')).toBe(1);

    // E a sugestão do próximo nunca aponta a quem já pediu enquanto houver
    // quem não pediu.
    const proximo = nextResponsible([r1, r2, r3, r4], doze);
    expect(['nelio', 'martinho', 'ze', 'joao']).not.toContain(proximo);
  });
});
