import inquirer from 'inquirer';

export interface ShotCard {
  title: string;
  designer: string;
  url: string;
}

/**
 * Presents an interactive multi-select prompt allowing the user
 * to choose which shots to download.
 */
export async function selectShots(shots: ShotCard[]): Promise<ShotCard[]> {
  if (shots.length === 0) return [];

  const choices = shots.map((shot, i) => ({
    name: `${i + 1}. [${shot.designer}] ${shot.title}`,
    value: i,
    checked: true, // All selected by default
  }));

  const { selectedIndices } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'selectedIndices',
      message: 'Select which shots to download (press <space> to toggle, <a> to toggle all):',
      choices,
      validate: (answer: number[]) => {
        if (answer.length === 0) {
          return 'You must select at least one shot!';
        }
        return true;
      },
    },
  ]);

  return selectedIndices.map((i: number) => shots[i]);
}
